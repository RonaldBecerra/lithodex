import React, { Component } from 'react';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
} from 'react-native';
import Expo, { Constants } from 'expo';
import DropdownAlert from 'react-native-dropdownalert';

export default class App extends Component {
  state = {
    compatible: false,
  };

  componentDidMount() {
    this.checkDeviceForHardware();
  }

  checkDeviceForHardware = async () => {
    let compatible = await Expo.Fingerprint.hasHardwareAsync();
    this.setState({ compatible });
    if (!compatible) {
      this.showIncompatibleAlert();
    }
  };

  showIncompatibleAlert = () => {
    this.dropdown.alertWithType(
      'error',
      'Incompatible Device',
      'Current device does not have the necessary hardware to use this API.'
    );
  };

  checkForBiometrics = async () => {
    let biometricRecords = await Expo.Fingerprint.isEnrolledAsync();
    if (!biometricRecords) {
      this.dropdown.alertWithType(
        'warn',
        'No Biometrics Found',
        'Please ensure you have set up biometrics in your OS settings.'
      );
    } else {
      this.handleLoginPress();
    }
  };
  
  handleLoginPress = () => {
    if (Platform.OS === 'android') {
      this.showAndroidAlert();
    } else {
      this.scanBiometrics();
    }
  };

  showAndroidAlert = () => {
    Alert.alert('Fingerprint Scan', 'Place your finger over the touch sensor.');
    this.scanBiometrics();
  };

  scanBiometrics = async () => {
    let result = await Expo.Fingerprint.authenticateAsync('Biometric Scan.');
    if (result.success) {
      this.dropdown.alertWithType(
        'success',
        'You are you!',
        'Bio-Authentication succeeded.'
      );
    } else {
      this.dropdown.alertWithType(
        'error',
        'Uh oh!',
        'Bio-Authentication failed or canceled.'
      );
    }
  };

  render() {
    return (
      <View style={styles.container}>
        <Image
          style={styles.logo}
          source={require('./src/assets/lithodex_icon.png')}
        />
        <TouchableOpacity
          onPress={
            this.state.compatible
              ? this.checkForBiometrics
              : this.showIncompatibleAlert
          }
          style={styles.button}>
          <Text style={styles.buttonText}>
            Bio Login
          </Text>
        </TouchableOpacity>
        <DropdownAlert
          ref={ref => (this.dropdown = ref)}
          closeInterval={5000}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    //paddingTop: Constants.statusBarHeight,
    paddingTop: 10,
    backgroundColor: '#056ecf',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 60,
    backgroundColor: 'transparent',
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  buttonText: {
    fontSize: 30,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.30)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  logo: {
    height: 128,
    width: 128,
  },
});

// import React, { Component } from 'react';
// import {
//   Text,
//   View,
//   StyleSheet,
//   TouchableOpacity,
//   Alert,
//   Platform,
// } from 'react-native';
// import * as LocalAuthentication from 'expo-local-authentication';
// import Constants  from 'expo-constants';

// export default class App extends Component {
//   state = {
//     compatible: false,
//     fingerprints: false,
//     result: '',
//   };

//   componentDidMount() {
//     this.checkDeviceForHardware();
//     this.checkForFingerprints();
//   }

//   checkDeviceForHardware = async () => {
//     let compatible = await LocalAuthentication.hasHardwareAsync();
//     this.setState({ compatible });
//   };

//   checkForFingerprints = async () => {
//     let fingerprints = await LocalAuthentication.isEnrolledAsync();
//     this.setState({ fingerprints });
//   };

//   scanFingerprint = async () => {
//     let result = await LocalAuthentication.authenticateAsync(
//       'Scan your finger.'
//     );
//     console.log('Scan Result:', result);
//     this.setState({
//       result: JSON.stringify(result),
//     });
//   };

//   showAndroidAlert = () => {
//     Alert.alert(
//       'Fingerprint Scan',
//       'Place your finger over the touch sensor and press scan.',
//       [
//         {
//           text: 'Scan',
//           onPress: () => {
//             this.scanFingerprint();
//           },
//         },
//         {
//           text: 'Cancel',
//           onPress: () => console.log('Cancel'),
//           style: 'cancel',
//         },
//       ]
//     );
//   };

//   render() {
//     return (
//       <View style={styles.container}>
//         <Text style={styles.text}>
//           Compatible Device? {this.state.compatible === true ? 'True' : 'False'}
//         </Text>
//         <Text style={styles.text}>
//           Fingerprings Saved?{' '}
//           {this.state.fingerprints === true ? 'True' : 'False'}
//         </Text>
//         <TouchableOpacity
//           onPress={
//             Platform.OS === 'android'
//               ? this.showAndroidAlert
//               : this.scanFingerprint
//           }
//           style={styles.button}>
//           <Text style={styles.buttonText}>SCAN</Text>
//         </TouchableOpacity>
//         <Text>{this.state.result}</Text>
//       </View>
//     );
//   }
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'space-around',
//     paddingTop: Constants.statusBarHeight,
//     backgroundColor: '#ecf0f1',
//   },
//   text: {
//     fontSize: 18,
//     textAlign: 'center',
//   },
//   button: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     width: 150,
//     height: 60,
//     backgroundColor: '#056ecf',
//     borderRadius: 5,
//   },
//   buttonText: {
//     fontSize: 30,
//     color: '#fff',
//   },
// });
