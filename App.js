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

// https://github.com/NightscoutFoundation/xDrip/blob/c48ef307c6dd28f6f6027a775a2b82c89a5b281d/app/src/main/java/com/eveningoutpost/dexdrip/glucosemeter/BluetoothCHelper.java#L9
const getSfloat16 = (b0, b1) => {
  const mantissa = unsignedToSigned(
    unsignedByteToInt(b0) + ((unsignedByteToInt(b1) & 0x0f) << 8),
    12,
  );
  const exponent = unsignedToSigned(unsignedByteToInt(b1) >> 4, 4);
  return mantissa * Math.pow(10, exponent);
};

const unsignedByteToInt = b => {
  return b & 0xff;
};

const unsignedBytesToInt = (b, c) => {
  return ((unsignedByteToInt(c) << 8) + unsignedByteToInt(b)) & 0xffff;
};

const unsignedToSigned = (unsigned, size) => {
  if ((unsigned & (1 << (size - 1))) != 0) {
    unsigned = -1 * ((1 << (size - 1)) - (unsigned & ((1 << (size - 1)) - 1)));
  }
  return unsigned;
};

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
    if (connectedPeripheralId === data.peripheral) {
      setConnectedPeripheralId('');
    }

    console.log('Disconnected from ' + data.peripheral);
  };

  let receiveTimeout = null;
  let results = '';

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
      const sequence = (bytes[2] << 8) + bytes[1];

      // Little-endian ordering
      const year = (bytes[4] << 8) + bytes[3];
      const month = bytes[5];
      const day = bytes[6];
      const hour = bytes[7];
      const minute = bytes[8];
      const second = bytes[9];

      const date = new Date(year, month - 1, day, hour, minute, second);

      let offset;
      let kgl;
      let mgdl;

      let ptr = 10;
      if (timeOffsetPresent) {
        offset = bytes[ptr] + bytes[ptr + 1] * 256;
        ptr += 2;
      }

      if (concentrationUnitKgL) {
        kgl = getSfloat16(bytes[ptr], bytes[ptr + 1]);
        mgdl = kgl * 100000;
      } else {
        Alert.alert('mmol not implemented!');
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
        date.toString() +
        ' - ' +
        (mgdl < 0 ? '-INFINITY' : mgdl) +
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
        const manufacturerName = bytesToString(data);
        console.log(manufacturerName);

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

  const disconnect = peripheralId => {
    return BleManager.disconnect(peripheralId).then(() => {
      let p = peripherals.get(peripheralId);
      if (p) {
        setConnectedPeripheralId('');
        p.connected = false;
        peripherals.set(peripheralId, p);
        setList(Array.from(peripherals.values()));
      }
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

              setConnectedPeripheralId(peripheral.id);
              getManufacturerName(peripheral.id);
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
              <Button title={'Open Settings'} onPress={() => openSettings()} />
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
