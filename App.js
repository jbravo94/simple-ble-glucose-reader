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
  const DEVICE_INFO_SERVICE = "0000180a-0000-1000-8000-00805f9b34fb";
  const MANUFACTURER_NAME = "00002a29-0000-1000-8000-00805f9b34fb";
  const GLUCOSE_SERVICE = "00001808-0000-1000-8000-00805f9b34fb";

  const GLUCOSE_CHARACTERISTIC = "00002a18-0000-1000-8000-00805f9b34fb";
  const CONTEXT_CHARACTERISTIC = "00002a34-0000-1000-8000-00805f9b34fb";
  const RECORDS_CHARACTERISTIC = "00002a52-0000-1000-8000-00805f9b34fb";

  const [isScanning, setIsScanning] = useState(false);
  const peripherals = new Map();
  const [list, setList] = useState([]);

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
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      setList(Array.from(peripherals.values()));
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

  const retrieveConnected = () => {
    BleManager.getConnectedPeripherals([]).then(results => {
      if (results.length == 0) {
        console.log('No connected peripherals');
      }
      console.log(results);
      for (var i = 0; i < results.length; i++) {
        var peripheral = results[i];
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
        setList(Array.from(peripherals.values()));
      }
    });
  };

  const handleDiscoverPeripheral = peripheral => {
    console.log('Got ble peripheral', peripheral);
    if (!peripheral.name) {
      peripheral.name = 'NO NAME';
    }
    peripherals.set(peripheral.id, peripheral);
    setList(Array.from(peripherals.values()));
  };

  const read = () => {
    BleManager.retrieveServices('48:70:1E:6D:60:CD').then(peripheralData => {

      BleManager.read('48:70:1E:6D:60:CD', DEVICE_INFO_SERVICE, MANUFACTURER_NAME).then((data) => {
        console.log(bytesToString(data));
      }).catch((error) => {
        console.log(JSON.stringify(error));
      });

      /*BleManager.startNotification(
        '48:70:1E:6D:60:CD',
        GLUCOSE_SERVICE,
        RECORDS_CHARACTERISTIC,
      ).then(() => {
        BleManager.startNotification(
          '48:70:1E:6D:60:CD',
          GLUCOSE_SERVICE,
          GLUCOSE_CHARACTERISTIC,
        ).then(() => {
          BleManager.startNotification(
            '48:70:1E:6D:60:CD',
            GLUCOSE_SERVICE,
            CONTEXT_CHARACTERISTIC,
          ).then(() => {
            BleManager.write(
              '48:70:1E:6D:60:CD',
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
      });*/

      //});
      /*const getAllData = stringToBytes('0101');*/

      /*BleManager.read(
        '48:70:1E:6D:60:CD',
        '0000180a-0000-1000-8000-00805f9b34fb',
        '00002a29-0000-1000-8000-00805f9b34fb',
      )
        .then(readData => {
          // Success code
          console.log('Read: ' + bytesToString(readData));
        })
        .catch(error => {
          // Failure code
          console.log(error);
        });*/
    });
  };

  const connect = () => {
    BleManager.getBondedPeripherals([]).then(bondedPeripheralsArray => {
      // Each peripheral in returned array will have id and name properties
      console.log(
        'Bonded peripherals: ' + JSON.stringify(bondedPeripheralsArray[1]),
      );
    });
    BleManager.connect('48:70:1E:6D:60:CD')
      .then(() => {
        Alert.alert('Connected');
        console.log('Connected');
      })
      .catch(error => {
        console.log('Connection error', error);
      });
  };

  const disconnect = () => {
    BleManager.disconnect('48:70:1E:6D:60:CD')
      .then(() => {
        Alert.alert('Disconnected');
        console.log('Disconnected');
      })
      .catch(error => {
        console.log('Connection error', error);
      });
  };

  const openSettings = () => {
    /*BluetoothStateManager.openSettings().then(() => {
      console.log(this.constructor.name, 'openSettings()', 'Success!');
    })
    .catch(error => {
      console.log(this.constructor.name, 'openSettings()', 'ERROR!', error.code, error);
    });*/
    try {
      RNBluetoothClassic.getBondedDevices()
        .then(paired => {
          console.log(JSON.stringify(paired));
        })
        .catch(error => {
          console.log(error);
        });
    } catch (err) {
      // Error if Bluetooth is not enabled
      // Or there are any issues requesting paired devices
    }
  };

  const testPeripheral = peripheral => {
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
            }
            console.log('Connected to ' + peripheral.id);

            setTimeout(() => {
              /* Test read current RSSI value */
              BleManager.retrieveServices(peripheral.id).then(
                peripheralData => {
                  console.log(peripheral.id);
                  console.log(
                    'Retrieved peripheral services',
                    JSON.stringify(peripheralData),
                  );

                  BleManager.readRSSI(peripheral.id).then(rssi => {
                    console.log('Retrieved actual RSSI value', rssi);
                    let p = peripherals.get(peripheral.id);
                    if (p) {
                      p.rssi = rssi;
                      peripherals.set(peripheral.id, p);
                      setList(Array.from(peripherals.values()));
                    }
                  });
                },
              );
            }, 900);
          })
          .catch(error => {
            console.log('Connection error', error);
          });
      }
    }
  };

  useEffect(() => {
    BleManager.start({showAlert: false});

    bleManagerEmitter.addListener(
      'BleManagerDiscoverPeripheral',
      handleDiscoverPeripheral,
    );
    bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan);
    bleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      handleDisconnectedPeripheral,
    );
    bleManagerEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      handleUpdateValueForCharacteristic,
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
              <Button title={'Open Settings'} onPress={() => openSettings()} />
            </View>

            <View style={{margin: 10}}>
              <Button title={'Connect Bluetooth'} onPress={() => connect()} />
            </View>

            <View style={{margin: 10}}>
              <Button
                title={'Disconnect Bluetooth'}
                onPress={() => disconnect()}
              />
            </View>

            <View style={{margin: 10}}>
              <Button title={'Read Bluetooth'} onPress={() => read()} />
            </View>

            <View style={{margin: 10}}>
              <Button
                title={'Scan Bluetooth (' + (isScanning ? 'on' : 'off') + ')'}
                onPress={() => startScan()}
              />
            </View>

            <View style={{margin: 10}}>
              <Button
                title="Retrieve connected peripherals"
                onPress={() => retrieveConnected()}
              />
            </View>

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
