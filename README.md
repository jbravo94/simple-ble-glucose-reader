# Introduction

This project shows the proof of concept to read data via Bluetooth from a glucometer with a React Native application.

An showcase of the prototype can be viewed on YouTube by clicking on the image or here https://youtu.be/pEUnmSh7OcE:

[![Simple BLE Glucose Reader](misc/images/screenshot.png?raw=true "Simple BLE Glucose Reader")](https://youtu.be/pEUnmSh7OcE "Simple BLE Glucose Reader")

# UML

## User Flow
![User Flow](misc/uml/userflow/userflow.png?raw=true "User Flow")

## Bluetooth Communication Flow
![BLE Flow](misc/uml/bleflow/bleflow.png?raw=true "BLE Flow")

# Observations

* Roche its Accu-Chek Guide Glucometer is certified against Continua Guidelines which mention among others the standards IEEE 11073-10417 (Personal Health Device/Glucose Meter) and IEEE 11073-20601 (Personal Health Device/Optimized Exchange Protocol). It also is certified against the Bluetooth specification SIG Glucose Profile and Glucose Service.
* Bytes in a data type greater that byte are transferred with ordering Little-Endian (https://en.wikipedia.org/wiki/Endianness).
* Glucose data is stored as 16 bit signed float. The IEEE-11073 16-bit SFLOAT differes from the IEEE 754 16-bit! 
* The HCI Log, a raw bluetooth communication dump, was hughely useful when explored with Wireshark.

# Tested Devices

## Glucometer
* Roche Accu-Chek Guide

## Smartphone
* Samsung Galaxy S20 (Android)

# Links

## Open Source Glucometer App xDrip
* https://github.com/NightscoutFoundation/xDrip

## Relevant React Native Libraries
* https://github.com/innoveit/react-native-ble-manager (https://www.youtube.com/watch?v=9barM9iyE0A)
* https://github.com/rusel1989/react-native-bluetooth-serial
* https://github.com/patlux/react-native-bluetooth-state-manager

## Bluetooth HCI Log
* https://fte.com/webhelpII/bpa600/Content/Documentation/WhitePapers/BPA600/Encryption/GettingAndroidLinkKey/RetrievingHCIlog.htm
* https://medium.com/@charlie.d.anderson/how-to-get-the-bluetooth-host-controller-interface-logs-from-a-modern-android-phone-d23bde00b9fa

## Signed Float in Bluetooth Standard 
* https://www.bluetooth.com/wp-content/uploads/2019/03/PHD_Transcoding_WP_v16.pdf
