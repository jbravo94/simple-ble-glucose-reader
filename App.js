/**
 * Sample BLE React Native App
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
} from 'react-native';
import {stringToBytes, bytesToString} from 'convert-string';
import {Colors} from 'react-native/Libraries/NewAppScreen';

import BleManager from 'react-native-ble-manager/BleManager';
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);
import BluetoothStateManager from 'react-native-bluetooth-state-manager';
import RNBluetoothClassic, {
  BluetoothEventType,
} from 'react-native-bluetooth-classic';

const App = () => {
  // Service
  const DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
  const MANUFACTURER_NAME = '00002a29-0000-1000-8000-00805f9b34fb';
  const GLUCOSE_SERVICE = '00001808-0000-1000-8000-00805f9b34fb';

  const GLUCOSE_CHARACTERISTIC = '00002a18-0000-1000-8000-00805f9b34fb';
  const CONTEXT_CHARACTERISTIC = '00002a34-0000-1000-8000-00805f9b34fb';
  const RECORDS_CHARACTERISTIC = '00002a52-0000-1000-8000-00805f9b34fb';

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
          console.log('Scanning...');
          setIsScanning(true);
        })
        .catch(err => {
          console.error(err);
        });
    }
  };

  const handleStopScan = () => {
    console.log('Scan is stopped');
    setIsScanning(false);
  };

  const handleDisconnectedPeripheral = data => {
    /*let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      setList(Array.from(peripherals.values()));
    }*/

    if (connectedPeripheralId === data.peripheral) {
      setConnectedPeripheralId('');
    }

    console.log('Disconnected from ' + data.peripheral);
  };

  let receiveTimeout = null;
  let results = '';

  const getSfloat16 = (b0, b1) => {
    /*const sign = (b1 & 0x80) > 0 ? -1 : 1;


    if(sign === -1) {
      b1=b1-128;
      b1=b1/8;
    }

    if(b0 >= 10) {
      b0 = b0/10;
    }
    return b0 * Math.pow(b1) *sign;*/

    let sign = 1;
    if (b1 - 128 > 0) {
      sign = -1;
      b1 = b1 - 128;
    }

    b1 = b1 / 16;

    if (b0 / 100 >= 1) {
      b0 = b0 / 100;
    } else if (b0 / 10 >= 1) {
      b0 = b0 / 10;
    }

    console.log(b0);
    console.log(b1);
    console.log(sign);
    return b0 * Math.pow(10, b1 * sign);
  };

  const handleUpdateValueForCharacteristic = data => {
    console.log(
      'Received data from ' +
        data.peripheral +
        ' characteristic ' +
        data.characteristic,
      data.value,
    );

    if (data.characteristic === GLUCOSE_CHARACTERISTIC) {
      const bytes = data.value;

      const flags = bytes[0];

      const timeOffsetPresent = (flags & 0x01) > 0;
      const typeAndLocationPresent = (flags & 0x02) > 0;
      const concentrationUnitKgL = (flags & 0x04) == 0;
      const sensorStatusAnnunciationPresent = (flags & 0x08) > 0;
      const contextInfoFollows = (flags & 0x10) > 0;

      // Little-endian ordering
      const sequence = bytes[1] + bytes[2] * 256;

      // Little-endian ordering
      const year = bytes[3] + bytes[4] * 256;
      const month = bytes[5];
      const day = bytes[6];
      const hour = bytes[7];
      const minute = bytes[8];
      const second = bytes[9];

      console.log(
        (day + '').padStart(2, '0') +
          '.' +
          (month + '').padStart(2, '0') +
          '.' +
          year +
          ' ' +
          (hour + '').padStart(2, '0') +
          ':' +
          (minute + '').padStart(2, '0') +
          ':' +
          (second + '').padStart(2, '0'),
      );

      let offset;
      let kgl;
      let mgdl;
      let mol;

      let ptr = 10;
      if (timeOffsetPresent) {
        offset = bytes[ptr] + bytes[ptr + 1] * 256;
        ptr += 2;
      }

      console.log(bytes[ptr]);
      console.log(bytes[ptr + 1]);
      if (concentrationUnitKgL) {
        kgl = getSfloat16(bytes[ptr], bytes[ptr + 1]);
        mgdl = kgl * 100000;
      } else {
        //mol = getSfloat16(bytes[ptr], bytes[ptr + 1]);
        //mgdl = mol * 1000;// * Constants.MMOLL_TO_MGDL;
      }
      ptr += 2;

      let typeAndLocation;
      let sampleLocation;
      let sampleType;
      if (typeAndLocationPresent) {
        typeAndLocation = bytes[ptr];
        sampleLocation = (typeAndLocation & 0xf0) >> 4;
        sampleType = typeAndLocation & 0x0f;
        ptr = ptr + 1;
      }

      let status;

      if (sensorStatusAnnunciationPresent) {
        status = bytes[ptr];
      }

      console.log(
        'Glucose data: mg/dl: ' +
          (mgdl > 10000 ? '-INFINITY' : mgdl) +
          '  kg/l: ' +
          (kgl > 1 ? '-INFINITY' : kgl) +
          '  seq:' +
          sequence +
          ' sampleType: ' +
          sampleType +
          '  sampleLocation: ' +
          sampleLocation +
          '  time: ' +
          hour +
          ':' +
          minute +
          ':' +
          second +
          '  ' +
          day +
          '-' +
          month +
          '-' +
          year +
          ' timeoffset: ' +
          offset,
      );

      results =
        results +
        (day + '').padStart(2, '0') +
        '.' +
        (month + '').padStart(2, '0') +
        '.' +
        year +
        ' ' +
        (hour + '').padStart(2, '0') +
        ':' +
        (minute + '').padStart(2, '0') +
        ':' +
        (second + '').padStart(2, '0') +
        ' - ' +
        (mgdl > 10000 ? '-INFINITY' : mgdl) +
        ' mg/dl' +
        '\n';
      if (receiveTimeout) {
        clearTimeout(receiveTimeout); //cancel the previous timer.
        receiveTimeout = null;
      }
      receiveTimeout = setTimeout(showResults, 500);
    }
  };

  const showResults = () => {
    Alert.alert('Glucose data:', results);
    results = '';
  };

  const disconnectConnected = () => {
    BleManager.getConnectedPeripherals([]).then(results => {
      if (results.length === 0) {
        console.log('No connected peripherals');
      }

      for (var i = 0; i < results.length; i++) {
        const peripheral = results[i];
        disconnect(peripheral.id).then(() => {
          setConnectedPeripheralId('');
          peripheral.connected = false;
          peripherals.set(peripheral.id, peripheral);
          setList(Array.from(peripherals.values()));
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
    BleManager.read(deviceId, DEVICE_INFO_SERVICE, MANUFACTURER_NAME)
      .then(data => {
        console.log(bytesToString(data));
      })
      .catch(error => {
        console.log(JSON.stringify(error));
      });
  };

  const read = () => {
    BleManager.retrieveServices(connectedPeripheralId).then(peripheralData => {
      BleManager.startNotification(
        connectedPeripheralId,
        GLUCOSE_SERVICE,
        RECORDS_CHARACTERISTIC,
      ).then(() => {
        BleManager.startNotification(
          connectedPeripheralId,
          GLUCOSE_SERVICE,
          GLUCOSE_CHARACTERISTIC,
        ).then(() => {
          BleManager.startNotification(
            connectedPeripheralId,
            GLUCOSE_SERVICE,
            CONTEXT_CHARACTERISTIC,
          ).then(() => {
            BleManager.write(
              connectedPeripheralId,
              GLUCOSE_SERVICE,
              RECORDS_CHARACTERISTIC,
              [1, 1],
            )
              .then(data => {
                // Success code
                console.log('Write: ' + data);
              })
              .catch(error => {
                // Failure code
                console.log(error);
              });
          });
        });
      });
    });
  };

  const connect = peripheralId => {
    BleManager.connect(peripheralId)
      .then(() => {
        Alert.alert('Connected');
        console.log('Connected');
      })
      .catch(error => {
        console.log('Connection error', error);
      });
  };

  const disconnect = peripheralId => {
    return BleManager.disconnect(peripheralId);
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

  const testPeripheral = peripheral => {
    disconnectConnected();

    if (peripheral) {
      if (peripheral.connected) {
        BleManager.disconnect(peripheral.id);
      } else {
        BleManager.connect(peripheral.id)
          .then(() => {
            let p = peripherals.get(peripheral.id);

            if (p) {
              p.connected = true;
              peripherals.set(peripheral.id, p);
              setList(Array.from(peripherals.values()));
              console.log(JSON.stringify(list));
            }
            console.log('Connected to ' + peripheral.id);
          })
          .catch(error => {
            console.log('Connection error', error);
          });
      }
    }
  };

  useEffect(() => {
    BleManager.start({showAlert: false});

    bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan);
    bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      handleDisconnectedPeripheral,
    );
    bleManagerEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      handleUpdateValueForCharacteristic,
    );
    bleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      handleDiscoverPeripheral,
    );

    if (Platform.OS === 'android' && Platform.Version >= 23) {
      PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ).then(result => {
        if (result) {
          console.log('Permission is OK');
        } else {
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
      console.log('unmount');
      bleManagerEmitter.removeListener(
        'BleManagerDiscoverPeripheral',
        handleDiscoverPeripheral,
      );
      bleManagerEmitter.removeListener('BleManagerStopScan', handleStopScan);
      bleManagerEmitter.removeListener(
        'BleManagerDisconnectPeripheral',
        handleDisconnectedPeripheral,
      );
      bleManagerEmitter.removeListener(
        'BleManagerDidUpdateValueForCharacteristic',
        handleUpdateValueForCharacteristic,
      );
    };
  }, []);

  const renderItem = item => {
    const color = item.connected ? 'green' : '#fff';
    return (
      <TouchableHighlight onPress={() => testPeripheral(item)}>
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
              <Button title={'Read Bluetooth'} onPress={() => read()} />
            </View>

            <View style={{margin: 10}}>
              <Button title={'Open Settings'} onPress={() => openSettings()} />
            </View>

            {connectedPeripheralId ? (
              <View style={{margin: 10}}>
                <Button
                  title={'Disconnect'}
                  onPress={() => disconnect(connectedPeripheralId)}
                />
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
