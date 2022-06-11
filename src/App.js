/**
 * Simple BLE Glucose Reader
 *
 * @format
 * @flow strict-local
 */

import React, {useState, useEffect} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  ScrollView,
  View,
  Text,
  StatusBar,
  NativeModules,
  NativeEventEmitter,
  Button,
  Platform,
  PermissionsAndroid,
  FlatList,
  TouchableHighlight,
  Alert,
  LogBox,
} from 'react-native';
import {bytesToString} from 'convert-string';
import {Colors} from 'react-native/Libraries/NewAppScreen';

import BleManager from 'react-native-ble-manager/BleManager';
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import GlucoseReadingRx from './GlucoseReadingRx';
import {getAllRecords} from './RecordsCmdTx';

// TODO Fix warning properly instead of hiding
LogBox.ignoreLogs(['new NativeEventEmitter']);

const App = () => {
  // Services
  const DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
  const MANUFACTURER_NAME_SERVICE = '00002a29-0000-1000-8000-00805f9b34fb';
  const GLUCOSE_SERVICE = '00001808-0000-1000-8000-00805f9b34fb';

  // Characteristics
  const GLUCOSE_CHARACTERISTIC = '00002a18-0000-1000-8000-00805f9b34fb';
  const CONTEXT_CHARACTERISTIC = '00002a34-0000-1000-8000-00805f9b34fb';
  const RECORDS_CHARACTERISTIC = '00002a52-0000-1000-8000-00805f9b34fb';

  let receiveTimeout = null;
  let results = '';

  const [isScanning, setIsScanning] = useState(false);
  const [peripherals, setPeripherals] = useState(new Map());
  const [list, setList] = useState([]);
  const [pairedDevices, setPairedDevices] = useState([]);
  const [connectedPeripheralId, setConnectedPeripheralId] = useState('');
  const [pairedDevicesRetrieved, setPairedDevicesRetrieved] = useState(false);

  const startScan = () => {
    if (!isScanning) {
      BleManager.scan([], 3, true)
        .then(results => {
          setIsScanning(true);
        })
        .catch(err => {
          console.error(err);
        });
    }
  };

  const handleStopScan = () => {
    setIsScanning(false);
  };

  const setConnectedPeripheral = peripheralId => {
    let p = peripherals.get(peripheralId);
    if (p) {
      setConnectedPeripheralId(peripheralId);
      p.connected = true;
      peripherals.set(peripheralId, p);
      setList(Array.from(peripherals.values()));
    }
  };

  const unsetConnectedPeripheral = peripheralId => {
    let p = peripherals.get(peripheralId);
    if (p) {
      setConnectedPeripheralId('');
      p.connected = false;
      peripherals.set(peripheralId, p);
      setList(Array.from(peripherals.values()));
    }
  };

  const showResults = () => {
    Alert.alert('Glucose data', results);
    results = '';
  };

  const disconnectConnected = () => {
    BleManager.getConnectedPeripherals([]).then(results => {
      if (results.length === 0) {
        return;
      }

      for (var i = 0; i < results.length; i++) {
        const peripheral = results[i];
        disconnect(peripheral.id).then(() => {
          unsetConnectedPeripheral(peripheral.id);
        });
      }
    });
  };

  const getPairedDevices = async () => {
    const paired = await RNBluetoothClassic.getBondedDevices();

    const pairedAddresses = paired.map(pairedDevice => pairedDevice.address);

    setPairedDevices(pairedAddresses);
    setPairedDevicesRetrieved(true);

    return pairedAddresses;
  };

  const handleDisconnectedPeripheral = data => {
    unsetConnectedPeripheral(data.peripheral);
  };

  const handleUpdateValueForCharacteristic = data => {
    if (data.characteristic === GLUCOSE_CHARACTERISTIC) {
      const result = new GlucoseReadingRx(data.value);

      results = results + result.toString() + '\n';

      if (receiveTimeout) {
        clearTimeout(receiveTimeout);
        receiveTimeout = null;
      }
      receiveTimeout = setTimeout(showResults, 500);
    }
  };

  const handleDiscoverPeripheral = async peripheral => {
    const paired = pairedDevicesRetrieved
      ? pairedDevices
      : await getPairedDevices();

    if (!peripheral.name || paired.indexOf(peripheral.id) === -1) {
      return;
    }

    peripherals.set(peripheral.id, peripheral);
    setList(Array.from(peripherals.values()));
  };

  const getManufacturerName = deviceId => {
    BleManager.read(deviceId, DEVICE_INFO_SERVICE, MANUFACTURER_NAME_SERVICE)
      .then(data => {
        const manufacturerName = bytesToString(data);

        switch (manufacturerName) {
          case 'Roche':
            Alert.alert('Supported Device detected: ' + manufacturerName);
            break;
          default:
            Alert.alert('Not supported Device detected: ' + manufacturerName);
        }
      })
      .catch(error => {
        console.log(JSON.stringify(error));
      });
  };

  const read = () => {
    BleManager.retrieveServices(connectedPeripheralId).then(
      async peripheralData => {
        await BleManager.startNotification(
          connectedPeripheralId,
          GLUCOSE_SERVICE,
          RECORDS_CHARACTERISTIC,
        );
        await BleManager.startNotification(
          connectedPeripheralId,
          GLUCOSE_SERVICE,
          GLUCOSE_CHARACTERISTIC,
        );
        await BleManager.startNotification(
          connectedPeripheralId,
          GLUCOSE_SERVICE,
          CONTEXT_CHARACTERISTIC,
        );

        BleManager.write(
          connectedPeripheralId,
          GLUCOSE_SERVICE,
          RECORDS_CHARACTERISTIC,
          getAllRecords(),
        )
          .then(data => {
            // Success code
          })
          .catch(error => {
            // Failure code
            console.log(error);
          });
      },
    );
  };

  const disconnect = peripheralId => {
    return BleManager.disconnect(peripheralId).then(() => {
      unsetConnectedPeripheral(peripheralId);
    });
  };

  const openSettings = () => {
    BluetoothStateManager.openSettings()
      .then(() => {
        console.log(this.constructor.name, 'openSettings()', 'Success!');
      })
      .catch(error => {
        console.log(
          this.constructor.name,
          'openSettings()',
          'ERROR!',
          error.code,
          error,
        );
      });
  };

  const connectPeripheral = peripheral => {
    disconnectConnected();

    if (peripheral) {
      if (peripheral.connected) {
        BleManager.disconnect(peripheral.id);
      } else {
        BleManager.connect(peripheral.id)
          .then(() => {
            setConnectedPeripheral(peripheral.id);
            getManufacturerName(peripheral.id);
          })
          .catch(error => {
            console.log('Connection error', error);
          });
      }
    }
  };

  const showInfo = () => {
    const steps = [];
    steps.push('1. Open settings and pair device first.');
    steps.push('2. Scan (Lists paired and reachable devices)');
    steps.push('3. Select device in list.');
    steps.push('4. Click on read to retrieve glucose data.');

    Alert.alert('Guide', steps.join('\n'));
  };

  useEffect(() => {
    BleManager.start({showAlert: false});

    const subscriptions = [];

    subscriptions.push(
      bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
    );

    subscriptions.push(
      bleManagerEmitter.addListener(
        'BleManagerDisconnectPeripheral',
        handleDisconnectedPeripheral,
      ),
    );

    subscriptions.push(
      bleManagerEmitter.addListener(
        'BleManagerDidUpdateValueForCharacteristic',
        handleUpdateValueForCharacteristic,
      ),
    );

    subscriptions.push(
      bleManagerEmitter.addListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral,
      ),
    );

    if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ).then(result => {
        if (!result) {
          PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ).then(result => {
            if (result) {
              console.log('User accept');
            } else {
              console.log('User refuse');
            }
          });
        }
      });
    }

    return () => {
      subscriptions.forEach(subscription => subscription.remove());
    };
    // TODO Fix this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderItem = item => {
    const color = item.connected ? 'green' : '#fff';
    return (
      <TouchableHighlight onPress={() => connectPeripheral(item)}>
        <View style={[styles.row, {backgroundColor: color}]}>
          <Text
            style={{
              fontSize: 12,
              textAlign: 'center',
              color: '#333333',
              padding: 10,
            }}>
            {item.name}
          </Text>
          <Text
            style={{
              fontSize: 10,
              textAlign: 'center',
              color: '#333333',
              padding: 2,
            }}>
            RSSI: {item.rssi}
          </Text>
          <Text
            style={{
              fontSize: 8,
              textAlign: 'center',
              color: '#333333',
              padding: 2,
              paddingBottom: 20,
            }}>
            {item.id}
          </Text>
        </View>
      </TouchableHighlight>
    );
  };

  return (
    <>
      <StatusBar barStyle="dark-content" />
      <Text style={styles.headline}>Simple BLE Glucose Reader</Text>
      <SafeAreaView>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={styles.scrollView}>
          {global.HermesInternal == null ? null : (
            <View style={styles.engine}>
              <Text style={styles.footer}>Engine: Hermes</Text>
            </View>
          )}
          <View style={styles.body}>
            <View style={{margin: 10}}>
              <Button
                title={'Scan Bluetooth (' + (isScanning ? 'on' : 'off') + ')'}
                onPress={() => startScan()}
              />
            </View>

            <View style={{margin: 10}}>
              <Button title={'Open Settings'} onPress={() => openSettings()} />
            </View>

            <View style={{margin: 10}}>
              <Button title={'Info'} onPress={() => showInfo()} />
            </View>

            {connectedPeripheralId ? (
              <View style={{margin: 10}}>
                <Button title={'Read Bluetooth'} onPress={() => read()} />
              </View>
            ) : null}

            {list.length == 0 && (
              <View style={{flex: 1, margin: 20}}>
                <Text style={{textAlign: 'center'}}>No peripherals</Text>
              </View>
            )}
          </View>
        </ScrollView>
        <FlatList
          data={list}
          renderItem={({item}) => renderItem(item)}
          keyExtractor={item => item.id}
        />
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  headline: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 36,
    paddingVertical: 10,
  },
  scrollView: {
    backgroundColor: Colors.lighter,
  },
  engine: {
    position: 'absolute',
    right: 0,
  },
  body: {
    backgroundColor: Colors.white,
  },
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.black,
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
    color: Colors.dark,
  },
  highlight: {
    fontWeight: '700',
  },
  footer: {
    color: Colors.dark,
    fontSize: 12,
    fontWeight: '600',
    padding: 4,
    paddingRight: 12,
    textAlign: 'right',
  },
});

export default App;
