import React, { Component } from 'react'
import { Text, View, StyleSheet, TextInput, ScrollView, Alert, 
		Dimensions,Picker, KeyboardAvoidingView, Button as ButtonNoIcon,
	    Image, Modal, TouchableHighlight, ActivityIndicator, Keyboard} from 'react-native'

import {Button as ButtonWithIcon, CheckBox, Avatar} from 'react-native-elements' // Usado para los botones con iconos
import DatePicker from 'react-native-datepicker' // Usado para la fecha

import { connect } from 'react-redux'
import { UserForm_Texts } from '../languages/screens/UserForm'
import { changeUser, changeUserName, changeUserProfileImage, changeSyncHandler } from '../redux/actions/userActions'

import ImageZoom from 'react-native-image-pan-zoom'
import * as ExpoImagePicker from 'expo-image-picker'
import * as Permissions     from 'expo-permissions'
import * as ExpoFileSystem  from 'expo-file-system'
import * as Network         from 'expo-network'

import PickerCheckBox from '../modifiedLibraries/PickerCheckBox'

import * as Log from '../genericFunctions/logFunctions'
import * as Database from '../genericFunctions/databaseFunctions'
import { genericStyles, DARK_GRAY_COLOR } from '../constants/genericStyles'
import * as auxiliarFunctions from '../genericFunctions/otherFunctions'

import * as D from '../constants/Dimensions'
import { DEFAULT_USER_ICON } from '../constants/genericImages'
import { remoteLithodex, USERS_TABLES_DOCUMENT_ID, URI_PREFIX } from '../constants/appConstants'

import PouchDB from 'pouchdb-react-native'
PouchDB.plugin(require('pouchdb-adapter-asyncstorage').default);


class UserForm extends Component {

	constructor(props) {
		super(props)
		this.acceptSettings  = this.acceptSettings.bind(this)
		this.refuseSettings  = this.refuseSettings.bind(this)
		this.keyboardDidShow = this.keyboardDidShow.bind(this)
		this.keyboardDidHide = this.keyboardDidHide.bind(this)

		// Propiedades que se iniicializan igual independientemente de si se está modificando un usuario ya existente o se está registrando uno nuevo
		let commonParameters = {
			modal_1_visible: false, // Aquí el usuario tiene la capacidad de colocar una imagen de perfil, o cambiar la ya existente (sólo se permite una a la vez)
			modal_2_visible: false, // Aquí se permite visualizar la imagen de perfil, agrandándola o haciéndola más pequeña
			modal_3_visible: false, // Aquí se decide el nombre de usuario y contraseña
			modal_4_visible: false, // Aquí el usuario debe introducir su contraseña previa para confirmar los cambios cuando está editando su perfil

			// Determina si los botones pueden ejecutar sus respectivas funciones, lo cual impide que se presione Aceptar y Cancelar o Volver
			// al mismo tiempo, o que se presione el mismo botón por accidente dos veces seguidas
			buttonsEnabled: true,

			profileImage_width:  null, // Anchura original de la imagen de perfil
			profileImage_height: null, // Altura original de la imagen de perfil

			// Determina si el teclado está visible. Esto lo pusimos porque no queremos que los botones de "Aceptar" y "Cancelar" de la parte inferior cierren la vista cuando el teclado está visible
			keyboardAvailable: false,

			// Determina si hay que adquirir la información del usuario no autenticado
			acquireInformation: false, 

			// Determina si hay conexión con el servidor
			connectionToServer: true,

			// Indica si debe mostrarse el mensaje "Cargando", que puede indicar que se está intentando reestablecer la conexión, o que se está intentando salvar el usuario en la base de datos
			loading: false,
		}

		let info = this.props.navigation.getParam('information');

		// Caso en que se quiere modificar la información de un usuario ya existente
		if (info != null){

			let {firstName, secondName, firstSurname, secondSurname, email, birthDate, country, 
				city, profession, officePhoneNumber, mobilePhoneNumber, postalCode, profileImage} = info;

			this.state = {
				...commonParameters,
				isNew: false,

				// Recuperamos el identificador de usuario, el cual es el nombre de su base de datos, aunque también podríamos simplemente usar "this.props.user_id", porque el usuario no ha cambiado
				_id: this.props.navigation.getParam('_id'),

				// Información que recuperamos de "info"
				firstName, secondName, firstSurname, secondSurname, email, birthDate, country, city, profession, officePhoneNumber, mobilePhoneNumber, postalCode, profileImage,
				
				// Nombre de usuario
				previousUserName:      this.props.navigation.getParam('userName'), // Esto es de sólo lectura, puesto que almacena el nombre de usuario que había sido añadido previamente
				userName:              this.props.navigation.getParam('userName'), // Nombre de usuario ingresado actualmente
				userNameIsNotRepeated: true, // Verifica si el nombre de usuario ingresado no existe en la base de datos

				// Distintas variables para manejar la contraseña
				previousPassword:   this.props.navigation.getParam('password'), // Contraseña que se había creado anteriormente. (Esto es de sólo lectura)
				definitivePassword: null, // En principio, ésta es la contraseña que se salvará en la base de datos, pero si se mantiene como null, la que se salvará es "previousPassword"
				passwordForVerificationMatching: null, // Aquí se guarda la contraseña que es ingresada por segunda vez, que confirma la otra para que no haya riesgo de que se haya ingresado mal
				previousPasswordConfirmation:    null, // Contraseña que ingresa el usuario en el último modal, que debe coinicidir con "previousPassword"

				new_or_current_passwordMatches:  true,  // Variable que establece si "definitivePassword" coincide con "passwordForVerificationMatching"
				previousPasswordMatches:         false, // Variable que establece si "previousPasswordConfirmation" coincide con "previousPassword"
			}
		} 
		else { // Caso en que se quiere registrar un usuario nuevo

			let firstName, secondName, firstSurname, secondSurname, email, birthDate, country, city, profession, officePhoneNumber, mobilePhoneNumber, postalCode, profileImage;
			firstName = secondName = firstSurname = secondSurname = email = birthDate = country = city = profession = officePhoneNumber = mobilePhoneNumber = postalCode = profileImage = null;
			
			this.state = {
				...commonParameters,
				isNew: true,

				firstName, secondName, firstSurname, secondSurname, email, birthDate, country, city, profession, 
				officePhoneNumber, mobilePhoneNumber, postalCode, profileImage,

				// Nombre de usuario
				userName: null,
				userNameIsNotRepeated: true, // Verifica si el nombre de usuario ingresado no existe en la base de datos

				// Distintas variables para manejar la contraseña
				definitivePassword: null,              // Contraseña que se salvará en la base de datos
				passwordForVerificationMatching: null, // Aquí se guarda la contraseña que es ingresada por segunda vez, que confirma la otra para que no haya riesgo de que se haya ingresado mal

				new_or_current_passwordMatches: true, // Variable que establece si "definitivePassword" coincide con "passwordForVerificationMatching"
			}
		}
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps }) => ({
		title:           UserForm_Texts[screenProps.language][0],
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		}
	});

	async componentDidMount(){
		// Aquí inicializamos los escuchas que determinan si el teclado se está mostrando o no
		this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow);
		this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide);

		// Para registrar en el "log" que se entró en el formulario de usuario
		Log.log_action({entry_code: ((this.props.navigation.getParam('firstName')) ? 25 : 24), user_id: this.props.user_id});

		this.determineConnection();

		this.setState({firstName: "Ronald", firstSurname: "Becerra", email: "ronaldbecerrag@gmail.com", userName: "ronald", definitivePassword: "111111", passwordForVerificationMatching: "111111"});
	}

	// Esto determina si hay conexión a Internet o no
	async determineConnection(setLoading=false){
		if (setLoading){
			this.setState({loading: true});
		}
		const {isInternetReachable, isConnected} = await Network.getNetworkStateAsync();
		await this.setState({connectionToServer: isInternetReachable && isConnected});

		if (setLoading){
			this.setState({loading: false});
		}
	}

	// Quitamos los escuchas cuando salimos de esta ventana
	componentWillUnmount() {
		this.keyboardDidShowListener.remove();
		this.keyboardDidHideListener.remove();
	}

	// Caso en que el teclado se está mostrando
	keyboardDidShow() {
		this.setState({keyboardAvailable: true});
	}

	// Caso en que el teclado se ocultó
	keyboardDidHide() {
		this.setState({keyboardAvailable: false});
	}

	// Función para determinar si un nombre de usuario está disponible o no
	determineUserNameExistence = async(text=null) => {
		let s = this.state;
		
		if (text == null){
			text = s.userName;
		}

		// El nombre de usuario es válido si se está editando un usuario ya existente y el nombre de usuario no ha cambiado, 
		// o si no existe en la lista global de nombres de usuario 
		if (!s.isNew && (text == s.previousUserName)){
			this.setState({userNameIsNotRepeated: true});
		}
		else {
			await remoteLithodex.get(USERS_TABLES_DOCUMENT_ID)
				.then(document => {  
					// Determinamos si la cadena "text" ya es usada como nombre de usuario por parte de otro usuario.
					this.setState({userNameIsNotRepeated: !document.userNames.hasOwnProperty(text)});
				}).catch(error => {
					// Esperamos que el único error posible sea que no haya conexión
					this.determineConnection();
					this.setState({userNameIsNotRepeated: false});
				})	
		}
	}

	// Para hacer visible el modal en el que se visualiza la imagen de perfil en un cuadro, junto con los botones de agregar nueva o eliminar la ya existente
	setModal_1_Visible = (isVisible) => {
		let s = this.state;
		let p = this.props;
		if (s.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {
				if (isVisible){
					// Sólo permitimos avanzar a la siguiente vista si se llenaron los campos obligatorios, y si el correo electrónico es válido
					if ((s.firstName != null) && (s.firstSurname != null)){

						// Aquí verificamos si el correo electrónico es válido
						if (auxiliarFunctions.isValidEmail(s.email)){
							this.setState({modal_1_visible: true});
						}
						else {
							// Alerta: "El correo electrónico no es válido"
							Alert.alert(p.allMessages[1], p.allMessages[2]);
						}	
					}
					else {
						// Alerta: "El primer nombre y el primer apellido no pueden ser nulos"
						Alert.alert(p.allMessages[1], p.allMessages[3])
					}
				}
				else {
					this.setState({modal_1_visible: false});
				}
			})
		}
		this.setState({buttonsEnabled: true});
	}

	// Para hacer visible el modal en el que se visualiza la imagen de perfil con sus dimensiones originales, y se permite hacerle zoom
	setModal_2_Visible = (isVisible) => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {
				if (isVisible){
					if (this.state.profileImage != null){
						Image.getSize(this.state.profileImage, (width, height) => {
							this.setState({
								modal_2_visible:     true,
								profileImage_width:  width, 
								profileImage_height: height,	
							}, () => this.setState({buttonsEnabled: true}))
						})	
					}
				} else {
					this.setState({
						modal_2_visible:     false,
						profileImage_width:  null, 
						profileImage_height: null,	
					}, () => this.setState({buttonsEnabled: true}))
				}
			})
		}
	}

	// Para hacer visible el modal en el que se ingresa el nombre de usuario y la contraseña
	setModal_3_Visible = (isVisible) => {
		this.determineConnection();

		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {			
				this.setState({modal_3_visible: isVisible}, () => this.setState({buttonsEnabled: true}))
			})
		}
	}

	// Para hacer visible el modal en el que se ingresa la contraseña anterior, para confirmar cambios realizados en el perfil
	// Nótese que esto sólo se activa cuando estamos editando un perfil creado previamente
	setModal_4_Visible = (isVisible) => {
		this.determineConnection();

		let s = this.state;
		let p = this.props;

		if (s.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {	
				if (isVisible) {
					if ((!s.userNameIsNotRepeated) || (s.userName.length < 5)){
						// Alerta: "No puede usar este nombre de usuario"
						Alert.alert(p.allMessages[1], p.allMessages[7]);
						this.setState({buttonsEnabled: true});
					} 
					else if (s.new_or_current_passwordMatches){
						if ((s.definitivePassword != null) && (s.passwordForVerificationMatching != null) && (s.definitivePassword.length > 5)){
							this.setState({modal_4_visible: true}, () => this.setState({buttonsEnabled: true}));
						}
						else if ((s.definitivePassword == null) && (s.passwordForVerificationMatching == null)){
							this.setState({modal_4_visible: true}, () => this.setState({buttonsEnabled: true}));
						}
						else {
							// Alerta: "Contraseña incorrecta"
							Alert.alert(p.allMessages[1], p.allMessages[8]);					
						}
					}
					else {
						// Alerta: "Contraseña incorrecta"
						Alert.alert(p.allMessages[1], p.allMessages[8]);
						this.setState({buttonsEnabled: true});
					}	
				} else {
					this.setState({modal_4_visible: false}, () => this.setState({buttonsEnabled: true}));
				}
			})
		}			
	}

	// ------------------------------------ Procedimientos relacionados con lo que se coloca en la información del usuario -------------------------------------------------------

	// Función genérica para todos los casos en los que el dato ingresado es un texto plano
	onChangePlainText = (variableName, text) => {
		if ((text == " ") || (text == "")){
			text = null;
		}
		let object = {};
		object[variableName] = text;
		this.setState(object);	
	}

	// Procedimiento para cambiar el nombre de usuario de la persona
	onChangeUserName = (text) => {
		let s = this.state;
		if (text == " "){
			text = null;
		}

		if (text != null){
			this.determineConnection();
			if (text.length < 5){
				this.setState({userName: text, userNameIsNotRepeated: false});
			}
			else {
				this.determineUserNameExistence(text);
				this.setState({userName: text});
				
			}
		}
	}

	// Procedimiento para cambiar la contraseña definitiva, es decir, la que en principio se salvará en la base de datos
	onChangeDefinitivePassword = (text) => {	
		if (text == this.state.passwordForVerificationMatching){
			this.setState({definitivePassword: text, new_or_current_passwordMatches: true});
		}		
		else {
			this.setState({definitivePassword: text, new_or_current_passwordMatches: false});
		}
	}

	// Procedimiento para cambiar la segunda contraseña que ingresa el usuario, que es la que debe coincidir con la primera
	onChangePasswordForVerificationMatching = (text) => {	
		if (text == this.state.definitivePassword){
			this.setState({passwordForVerificationMatching: text, new_or_current_passwordMatches: true});
		}		
		else {
			this.setState({passwordForVerificationMatching: text, new_or_current_passwordMatches: false});
		}
	}

	/* Este procedimiento sólo se activa cuando un usuario está editando un perfil creado previamente. Aquí debe ingresar la contraseña anterior
	   (puesto que puede haberse cambiado la contraseña), para verificar que es la misma persona la que está cambiando los datos */
	onChangePreviousPasswordConfirmation = (text) => {	
		if (text == this.state.previousPassword){
			this.setState({previousPasswordConfirmation: text, previousPasswordMatches: true});
		}
		else {
			this.setState({previousPasswordConfirmation: text, previousPasswordMatches: false});
		}
	}

	// ------------------------------------ Procedimientos relacionados con la imagen de perfil -------------------------------------------------------

	// Procedimiento para acceder a la galería de imágenes (o desde cualquier otro directorio) y poder escoger de allí una imagen
	selectPictureFromGallery = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, async() => {
				const {status} = await Permissions.askAsync(Permissions.CAMERA_ROLL);

				if (status !== 'granted'){
					// Alerta: "No tiene permiso para acceder a la galería"
					Alert.alert(this.props.allMessages[1], this.props.allMessages[9]);
				}
				else {
					const { cancelled, uri, base64 } = await ExpoImagePicker.launchImageLibraryAsync({allowsEditing: true, base64: true});

					// Caso en que el usuario sí seleccionó una imagen en la galería
					if(!cancelled) { 
						// Borramos la imagen que se crea en la caché para sólo quedarnos con la "base64", que es la que podemos almacenar en la base de datos
						ExpoFileSystem.deleteAsync(uri);
						this.setState({profileImage: URI_PREFIX + base64});
					} 
				}
				this.setState({buttonsEnabled: true});
			})
		}
	}

	// Procedimiento para poder tomar una nueva foto con la cámara del dispositivo móvil
	takePicture = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, async() => {
				const {status} = await Permissions.askAsync(Permissions.CAMERA);

				if (status !== 'granted'){
					// Alerta: "No tiene permiso para acceder a la cámara"
					Alert.alert(this.props.allMessages[1], this.props.allMessages[10]);
				}
				else {
				// Haciendo pruebas se obtuvo que con calidad máxima el documento de imagen luego no pede ser encontrado. Por eso la bajamos a 0.99
				const { cancelled, uri, base64 } = await ExpoImagePicker.launchCameraAsync({allowsEditing: true, base64: true, quality: 0.99});

					// Caso en que el usuario sí capturó una fotografía
					if(!cancelled) { 
						// Borramos la imagen que se crea en la caché para sólo quedarnos con la "base64", que es la que podemos almacenar en la base de datos
						ExpoFileSystem.deleteAsync(uri);
						this.setState({profileImage: URI_PREFIX + base64});
					}
				}
				this.setState({buttonsEnabled: true});
			})
		}
	}

	// Eliminar la imagen de perfil
	deleteImage(){
		if (this.state.profileImage != null){
			let p = this.props;

			// Alerta: "¿Seguro de que desea eliminar la imagen?"
			Alert.alert(p.allMessages[1], p.allMessages[4],
				[
					// Mensaje: "Sí"
					{text: p.allMessages[5], onPress: () => this.setState({profileImage: null})},
					// Mensaje: "No"
					{text: p.allMessages[6]},
				] 
			)	
		}
	}

	// ------------------------------------ Procedimientos para salvar o rechazar los cambios -------------------------------------------------------

	// Procedimiento para hacer los cambios correspondientes en la base de datos (creación o actualízación)
	// Aquí pasamos a la siguiente pantalla y se le pasa el payload como props de Navigation
	acceptSettings = () => {  	
		let s = this.state;
		let p = this.props;
		var correct = true; // Determina si se pueden salvar los datos
		var passwordToSave = s.definitivePassword;

		// Caso en que estamos creando un usuario nuevo
		if (s.isNew) {
			if ((!s.userNameIsNotRepeated) || (s.userName.length < 5)){
				// Alerta: "No puede usar este nombre de usuario"
				Alert.alert(p.allMessages[1], p.allMessages[7]);
				correct = false;
			} 
			else if ((s.definitivePassword == null) || (s.definitivePassword.length < 6) || (!s.new_or_current_passwordMatches)){
				// Alerta: "Contraseña incorrecta"
				Alert.alert(p.allMessages[1], p.allMessages[8]);
				correct = false;
			}	
		} else {
			if (!s.previousPasswordMatches){
				// Alerta: "Contraseña incorrecta"
				Alert.alert(p.allMessages[1], p.allMessages[8]);
				correct = false;
			}
			else if (passwordToSave == null){
				passwordToSave = s.previousPassword;
			}
		}

		// Caso en que se pueden salvar los datos
		if (correct && this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false, loading: true},
				async() => {
					try {
						let {userName, firstName, secondName, firstSurname, secondSurname, email, birthDate, country,
							city, profession, officePhoneNumber, mobilePhoneNumber, postalCode, profileImage} = this.state;

						// Si estamos creando un nuevo usuario le creamos un identificador. Éste será el nombre de su base de datos
						let _id = s.isNew ? auxiliarFunctions.generateUser_id() : s._id;

						const payload = {
							_id, userName,
							password: passwordToSave,

							// Estas otras propiedades se agrupan en una más general llamada "information"
							information: {
								firstName, secondName, firstSurname, secondSurname, email, birthDate, country, 
								city, profession, officePhoneNumber, mobilePhoneNumber, postalCode, profileImage,			
							},
						};

						// Base de datos local del usuario
						const localUserDB = s.isNew ? new PouchDB(_id) : this.props.localDB;

						const error = await Database.saveUserInfo(payload, localUserDB, s.isNew, s.acquireInformation); 

						// Si ocurrió un error tratando de salvar en la base de datos, abortamos
						if (error){
							this.determineUserNameExistence(); // Tal vez el error fue que el nombre de usuario ya estaba ocupado; por ello determinamos esto nuevamente
							throw error;
						}

						p.dispatchNewProfileImage(profileImage);
						p.dispatchUserName(userName);

						if (s.isNew){
							await p.dispatchNewUser(_id);								
							await p.dispatchSyncHandler(
								PouchDB.sync(this.props.localDB,this.props.remoteDB, {
									live: true, // Hace que la replicación continúe indefinidamente, en lugar de hacerse una sola vez
									retry: true // Si el usuario pierde la conexión, "retry" hace que la replicación se reanude una vez dicha conexión se reestablezca
								}).on('active', (info) => {
									// Cada vez que la replicación esté activa nuevamente tenemos que transferir las entradas necesarias del log
									Log.exportLogEntries(this.props.user_id, this.props.remoteDB);
								})
							);
							// Alerta: "Se ha iniciado sesión como '<Nombre de usuario>'"
							Alert.alert(p.allMessages[1], p.allMessages[50]+userName+"'");
						} else {
							// Alerta: "Los cambios fueron salvados"
							Alert.alert(p.allMessages[1], p.allMessages[51]);				
						}

						p.navigation.goBack();
					} catch(error) {
						this.setState({buttonsEnabled: true, modal_4_visible: false, loading: false});
						// Alerta: "Ocurrió un error"
						Alert.alert(p.allMessages[1], p.allMessages[49]);				
					}			
				}
			)
		} 
	}

	// Procedimiento para el caso en que el usuario le da al botón de Volver
	refuseSettings = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {	
				let p = this.props;
				// Alerta: "No se salvaron los cambios"
				Alert.alert(p.allMessages[1], p.allMessages[11]);
				p.navigation.goBack();
			})
		}
	};

	// ---------------------------------------------------------- Vistas --------------------------------------------------------------

	// Formato de los campos que consisten en texto plano, en los que el título del campo está al lado del recuadro donde el usuario escribe
	plainTextField(mainMessage, variable, variableName, cannotBeEmpty, autoCapitalize='sentences', secureTextEntry=false, functionToApply=null){
		return(
			<View style = {genericStyles.row_instructions_textInput}>
				{cannotBeEmpty && // Caso en que el campo es obligatorio
					<View style = {{flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
						<Text style = {{flex: 1, color: 'red', fontWeight: 'bold'}}>*
							<Text style = {{color: 'black'}}> {mainMessage}: </Text> 
						</Text>
					</View>
				}
				{!cannotBeEmpty && /// Caso en que el campo NO es obligatorio
					<View style = {{flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
						<Text style = {{flex:1}}>{mainMessage}: </Text>
					</View>
				}

				{/*Nótese que en el caso en que hay que aplicar una función recibida como parámetro no indicamos el nombre de la variable, 
				   porque en todos los casos en que ello ocurre en esta ventana dicha función sólo trabaja para una variable específica */}
				<TextInput 
					defaultValue      = {variable}
					selectTextOnFocus = {true}
					textAlign         = {'center'} 
					style             = {genericStyles.textInput}
					placeholder       = {this.props.allMessages[12]} // Mensaje: "Rellenar campo..."
					onChangeText      = {text => ((functionToApply!=null) ? functionToApply(text) : this.onChangePlainText(variableName,text))}
					secureTextEntry   = {secureTextEntry}
					autoCapitalize    = {autoCapitalize}
				/>
			</View>
		)
	}

	/// Función principal de renderización
	render() {
		let s = this.state;
		let p = this.props;

		// Vista para cuando hay que mostrar el mensaje "Cargando"
		if (s.loading){
			return(
				<View style = {{...genericStyles.simple_center, paddingTop: '15%'}}>
					<ActivityIndicator size = "large" color = "#0000ff" />
					{/*Mensaje: "Cargando"*/}
					<Text>{this.props.allMessages[53]}...</Text>
				</View>
			)
		}

		return (
			<View style = {genericStyles.lightGray_background}>
				{/*Modales*/}
				{this.modal_1_View()}
				{this.modal_2_View()}
				{this.modal_3_View()}
				{this.modal_4_View()}


				{/*Primer sector que incluye todos los campos a rellenar*/}
				<View style = {genericStyles.white_background_with_ScrollView}>
					<ScrollView>

						{/*Mensaje: "Primer nombre"*/}
						{this.plainTextField(p.allMessages[13], s.firstName, 'firstName', true)}

						{/*Mensaje: "Primer apellido"*/}
						{this.plainTextField(p.allMessages[14], s.firstSurname, 'firstSurname', true)}

						{/*Modificar el correo electrónico de la persona*/}
						<View style = {genericStyles.instructionsAboveTextInputs}>
							{/*Mensaje: "Correo electrónico"*/}
							<Text style = {{flex: 1, paddingBottom: 3, color: 'red'}}>*
								<Text style = {{color: 'black', fontWeight: 'bold'}}> {p.allMessages[15]}: </Text>
							</Text>

							<View style = {{flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
								<TextInput 
									defaultValue      = {s.email}
									selectTextOnFocus = {true}
									textAlign         = {'center'} 
									style             = {genericStyles.textInput}
									placeholder       = {p.allMessages[12]} // Mensaje: "Rellenar campo..."
									onChangeText      = {text => this.onChangePlainText('email',text)}
									autoCapitalize    = "none"
								/>
							</View>
						</View>

						{/*Mensaje: "Segundo nombre"*/}
						{this.plainTextField(p.allMessages[16], s.secondName, 'secondName', false)}

						{/*Mensaje: "Segundo apellido"*/}
						{this.plainTextField(p.allMessages[17], s.secondSurname, 'secondSurname', false)}

						{/*Nodificar la fecha de nacimiento*/}
						<View style = {genericStyles.row_instructions_textInput}>
							{/*Mensaje: "Fecha de nacimiento: "*/}
							<Text style = {{flex:1}}>{p.allMessages[18]}: </Text>
							<DatePicker
								style          = {{flex: 1.05, height: 35, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'black'}}
								date           = {s.birthDate}
								mode           = "date"
								placeholder    = {p.allMessages[19]} /// Mensaje: "Toque para escoger.."
								format         = "DD-MM-YYYY"
								confirmBtnText = {p.allMessages[20]} // Mensaje: "Ok"
								cancelBtnText  = {p.allMessages[21]} // Mensaje: "Cancelar"
								showIcon       = {false}
								customStyles   = {{
									///dateIcon: {postion: 'absolute'}
									dateInput: {...genericStyles.textInput, padding: 0, borderColor: 'transparent'},
								}}
								onDateChange = {(date) => {this.setState({birthDate: date})}}
							/>
						</View>

						{/*//Mensaje: "País"*/}
						{this.plainTextField(p.allMessages[22], s.country, 'country', false)}

						{/*Mensaje: "Ciudad"*/}
						{this.plainTextField(p.allMessages[23], s.city, 'city', false)}

						{/*Mensaje: "Profesión"*/}
						{this.plainTextField(p.allMessages[24], s.profession, 'profession', false)}

						{/*Mensaje: "Teléfono de oficina"*/}
						{this.plainTextField(p.allMessages[25], s.officePhoneNumber, 'officePhoneNumber', false)}

						{/*Mensaje: "Teléfono móvil"*/}
						{this.plainTextField(p.allMessages[26], s.mobilePhoneNumber, 'mobilePhoneNumber', false)}

						{/*Mensaje: "Código postal"*/}
						{this.plainTextField(p.allMessages[27], s.postalCode, 'postalCode', false)}

					</ScrollView> 
				</View>

				{/*Vista de los botones para darle Cancelar o Siguiente*/}
				<View style = {genericStyles.down_buttons}>

					<View style = {{paddingRight: 25}}>
						<ButtonNoIcon 
							raised
							title   = {p.allMessages[21]} // Mensaje: "Cancelar"
							color   = {DARK_GRAY_COLOR}
							onPress = {s.keyboardAvailable ? Keyboard.dismiss : this.refuseSettings}
						/>
					</View>

					<View style = {{paddingLeft: 25}}>
						<ButtonWithIcon
							raised
							title   = {p.allMessages[28]} /// Mensaje: "Siguiente"
							icon    = {{name: 'arrow-forward'}}
							onPress = {() => {s.keyboardAvailable ? Keyboard.dismiss() : this.setModal_1_Visible(true)}}
						/>
					</View>

				</View>
			</View>
		);
	}

	// Ventana en donde se puede cambiar la imagen del perfil, permitiendo seleccionarla desde galería o tomando una nueva foto
	modal_1_View(){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {false}
					visible        = {this.state.modal_1_visible}
					onRequestClose = {() => this.setModal_1_Visible(false)}
				>
					<View style = {genericStyles.lightGray_background}>

						{/*Aquí se visualiza tanto la imagen como los botones para agregar una nueva desde galería, tomar una con la cámara o eliminar la ya existente*/}
						<View style = {genericStyles.white_background_with_ScrollView}>
							<ScrollView>

								{/*Mensaje: "Imagen de perfil"*/}
								<Text style = {genericStyles.subtitle}>{p.allMessages[29]}</Text>

								<View style = {{justifyContent: 'center', alignItems: 'center', paddingTop: 20, paddingBottom: 20}}>
									{/*//Aquí mostramos la imagen del perfil*/}
									{(s.profileImage != null) &&
										<View>
											<TouchableHighlight 
												onPress     = {() => {this.setModal_2_Visible(true)}}
												onLongPress = {() => {this.setModal_2_Visible(true)}}  
												style       = {localStyles.touchableHighlight_NoBorder}
											>
												<Image 
													resizeMethod = "auto"
													source       = {{ uri: s.profileImage }}
													style        = {localStyles.touchableHighlight_WithBorder}
												/>
											</TouchableHighlight>
										</View>
									}

									{(s.profileImage == null) &&
										<View>
											<Avatar
												source         = {DEFAULT_USER_ICON}
												containerStyle = {localStyles.touchableHighlight_WithBorder}
											/>
										</View>
									}
								</View>

								<View style = {localStyles.buttonView}> 
									<ButtonWithIcon  // Botón para añadir una imagen desde archivo
										raised
										title   = {p.allMessages[30]} // Mensaje: "Elegir desde galería"
										onPress = {this.selectPictureFromGallery}
										icon    = {{name: 'add-to-photos'}}
									/>
								</View>

								<View style = {localStyles.buttonView}> 
									<ButtonWithIcon  ///Botón para capturar una fotografía
										raised
										title   = {p.allMessages[31]} // Mensaje: "Tomar nueva foto"
										onPress = {this.takePicture}
										icon    = {{name: 'add-a-photo'}}
									/>
								</View>

								<View style = {localStyles.buttonView}> 
									<ButtonNoIcon  ///Botón para eliminar la fotografía
										raised
										title   = {p.allMessages[32]} // Mensaje: "Eliminar imagen"
										color   = 'red'
										onPress = {this.state.buttonsEnabled ? () => {this.deleteImage()} : () => {}}
									/>
								</View>
							</ScrollView>
						</View>

						{/* Botón para regresar a la vista anterior */}
						<View style = {genericStyles.down_buttons}>
							<View style = {{paddingRight: 25}}>
								<ButtonNoIcon 
									raised
									title   = {p.allMessages[33]} // Mensaje: "Volver"
									color   = {DARK_GRAY_COLOR}
									onPress = {() => this.setModal_1_Visible(false)}
								/>
							</View>

							<View style = {{paddingLeft: 25}}>
								<ButtonWithIcon
									raised
									title   = {p.allMessages[28]} // Mensaje: "Siguiente"
									icon    = {{name: 'arrow-forward'}}
									onPress = {() => this.setModal_3_Visible(true)}
								/>
							</View>
						</View>
					</View>
				</Modal>
			</View>
		)
	}

	// Ventana para visualizar la imagen del perfil, permitiendo hacerle zoom
	modal_2_View(){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {false}
					visible        = {this.state.modal_2_visible}
					onRequestClose = {() => this.setModal_2_Visible(false)}
				>
					<View style = {genericStyles.lightGray_background}>

						{/*Aquí se visualiza la imagen menos el botón para volver*/}
						<View style = {genericStyles.white_background_with_ScrollView}>

							{/*Imagen mostrada*/}
							<View style = {localStyles.imageView}>
								<ImageZoom 
									cropWidth   = {0.9 * D.GLOBAL_SCREEN_WIDTH}  // Ancho del área operativa
									cropHeight  = {0.8 * D.GLOBAL_SCREEN_HEIGHT} // Alto del área operativa
									imageWidth  = {s.profileImage_width}  // Ancho de la imagen a mostrar
									imageHeight = {s.profileImage_height} // Alto de la imagen a mostrar
									enableCenterFocus = {false} // Si se deja esto en "true", siempre se enfoca el centro de la imagen
									minScale    = {1/100}
								>
									<Image 
										source = {{uri: s.profileImage}}
										style  = {{width: s.profileImage_width, height: s.profileImage_height}}
									/>
								</ImageZoom> 
							</View>
						</View>

						{/*// Botón para regresar a la vista anterior */}
						<View style = {genericStyles.down_buttons}>
							<ButtonNoIcon
								raised
								color   = {DARK_GRAY_COLOR}
								title   = {p.allMessages[33]} // Mensaje: "Volver"
								onPress = {() => this.setModal_2_Visible(false)}
							/>
						</View>
					</View>
				</Modal>
			</View>
		)
	}

	// Vista auxiliar para los modales 3 y 4, que se muestra en caso de que no haya conexión con el servidor
	auxiliarNoConnectionView(){
		let p = this.props;
		return(
			<View style = {{...genericStyles.simple_center, paddingTop: '15%'}}>
				{/*Mensaje: "Ocurrió un error"*/}
				<Text style = {{textAlign: 'center'}}>{p.allMessages[49]}</Text>

				<View style = {{height: 30}}/>

				<ButtonWithIcon
					raised
					icon    = {{name: 'cached'}}
					title   = {p.allMessages[52]} // Mensaje: "Volver a intentarlo"
					onPress = {() => this.determineConnection(true)}
				/>	
			</View>
		)
	}

	// Ventana en la que el usuario puede establecer el nombre de usuario y su contraseña
	modal_3_View(){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {false}
					visible        = {this.state.modal_3_visible}
					onRequestClose = {() => this.setModal_3_Visible(false)}
				>
					<View style = {genericStyles.lightGray_background}>

						{(!s.connectionToServer) && this.auxiliarNoConnectionView()}

						{s.connectionToServer &&  //En esta parte el usuario ingresa el nombre de usuario y la contraseña
							<View style = {genericStyles.white_background_with_ScrollView}>
								<ScrollView>
									{/*Mensaje: "Introduzca nombre de usuario y contraseña"*/}
									{(s.isNew) && <Text style = {genericStyles.subtitle}>{p.allMessages[34]}</Text>}

									{/*//Mensaje: "Modifique su nombre de usuario o contraseña (opcional)"*/}
									{(!s.isNew) && <Text style = {genericStyles.subtitle}>{p.allMessages[35]}</Text>}

									{/*//Mensaje: "Nombre de usuario (mín 5)"*/}
									<View style = {{height: 20}}/>
									{this.plainTextField(p.allMessages[36], s.userName, 'userName', true, "none", false, this.onChangeUserName)}

									{/*Caso en que el nombre de usuario ingresado es correcto o disponible*/}
									{ (s.userNameIsNotRepeated) && (s.userName != null) && (s.userName.length > 4) &&
										<View>
											{/*Mensaje: "Nombre de usuario disponible"*/}
											<Text style = {{flex: 1, flexDirection: 'row', paddingTop: 10, textAlign: 'center', color: 'green'}}>
												{p.allMessages[37]}
											</Text>
										</View>
									}

									{/*Caso en que el nombre de usuario ingresado no es correcto*/}
									{ ((!s.userNameIsNotRepeated) || ((s.userName != null) && (s.userName.length < 5))) &&
										<View>
											{/*Mensaje: "No puede usar este nombre de usuario"*/}
											<Text style = {{flex: 1, flexDirection: 'row', paddingTop: 10, textAlign: 'center', color: 'red'}}>
												{p.allMessages[7]}
											</Text>
										</View>
									}

									{/*Ingresar la contraseña -> primera vez*/}
									{/*Mensajes: "Contraseña\n(mín 6)"  "Nueva contraseña\n(opcional) (mín 6)"*/}
									<View style = {{height: 20}}/>
									{this.plainTextField(p.allMessages[(s.isNew ? 38 : 39)], s.definitivePassword, 'definitivePassword', (s.isNew ? true : false), "none", true, this.onChangeDefinitivePassword)}


									{/*Ingresar la contraseña -> primera vez*/}
									{/*Mensajes: "Confirme contraseña"  "Confirme nueva contraseña"*/}
									<View style = {{height: 20}}/>
									{this.plainTextField(p.allMessages[(s.isNew ? 40 : 41)], s.passwordForVerificationMatching, 'passwordForVerificationMatching', (s.isNew ? true : false), "none", true, this.onChangePasswordForVerificationMatching)}


									{/*Mensaje: "Contraseña correcta"*/}
									{ (s.new_or_current_passwordMatches) && (s.passwordForVerificationMatching != null) && (s.passwordForVerificationMatching.length > 5) &&
										<View>
											<Text style = {{flex: 1, flexDirection: 'row', paddingTop: 10, textAlign: 'center', color: 'green'}}>
												{p.allMessages[42]}
											</Text>
										</View>
									}

									{/*Mensaje: "Contraseña demasiado corta"*/}
									{ (s.definitivePassword != null) && (s.definitivePassword.length < 6) &&
										<View>
											<Text style = {{flex: 1, flexDirection: 'row', paddingTop: 10, textAlign: 'center', color: 'red'}}>
												{p.allMessages[43]}
											</Text>
										</View>
									}	

									{/*Mensaje: "Las contraseñas no coinciden"*/}
									{ (s.definitivePassword != null) && (s.definitivePassword.length > 5) && (!s.new_or_current_passwordMatches) && (s.passwordForVerificationMatching != null) &&
										<View>
											<Text style = {{flex: 1, flexDirection: 'row', paddingTop: 10, textAlign: 'center', color: 'red'}}>
												{p.allMessages[44]}
											</Text>
										</View>
									}	

									{/* Si se está creando un usuario, está este cuadro que permite determinar si se desea adquirir la información que se había guardado como usuario no autenticado*/}
									{ (s.isNew) &&
										<View style = {{paddingTop: 50, paddingBottom: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
											<CheckBox 
												title   = {p.allMessages[45]} // Mensaje: "Adquirir información del usuario no autenticado"
												checked = {s.acquireInformation}
												onPress = {() => {this.setState({acquireInformation: !s.acquireInformation})}}
											/>
										</View>	
									}					

								</ScrollView>
							</View>
						}

						{/*//Vista de los botones para darle Volver, y Aceptar o Siguiente*/}
						<View style = {genericStyles.down_buttons}>

							<View style = {{paddingRight: (s.connectionToServer ? 25 : 0)}}>
								<ButtonNoIcon 
									raised
									title   = {p.allMessages[33]} // Mensaje: "Volver"
									color   = {DARK_GRAY_COLOR}
									onPress = {() => {s.keyboardAvailable ? Keyboard.dismiss() : this.setModal_3_Visible(false)}}

								/>
							</View>

							{/*//Si se está creando un usuario, aquí ya aparece el botón de Aceptar*/}
							{ (s.isNew && s.connectionToServer) &&
								<View style = {{paddingLeft: 25}}>
									<ButtonWithIcon
										raised
										title   = {p.allMessages[46]} // Mensaje: "Aceptar"
										icon    = {{name: 'check'}}
										onPress = {() => {s.keyboardAvailable ? Keyboard.dismiss() : this.acceptSettings()}}
									/>
								</View>
							}

							{/*//En cambio, si se está editando un usuario ya creado, todavía falta una vista más*/}
							{ (!s.isNew && s.connectionToServer) &&
								<View style = {{paddingLeft: 25}}>
									<ButtonWithIcon
										raised
										title   = {p.allMessages[28]} // Mensaje: "Siguiente"
										icon    = {{name: 'arrow-forward'}}
										onPress = {() => {s.keyboardAvailable ? Keyboard.dismiss() : this.setModal_4_Visible(true)}}
									/>
								</View>
							}
						</View>
					</View>
				</Modal>
			</View>
		)
	}

	/// Ventana en la que el usuario debe ingresar la contraseña anterior para que se pueden salvar los cambios de edición de perfil
	modal_4_View(){
		let s = this.state;
		let p = this.props;
		
		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {false}
					visible        = {(!s.isNew) && this.state.modal_4_visible}
					onRequestClose = {() => this.setModal_4_Visible(false)}
				>
					<View style = {genericStyles.lightGray_background}>

						{(!s.connectionToServer) && this.auxiliarNoConnectionView()}

						{s.connectionToServer && 
							<View style = {genericStyles.white_background_with_ScrollView}>
								<ScrollView>

									{/*Mensaje: "Introduzca la contraseña anterior para confirmar"*/}
									{(s.definitivePassword != null) && <Text style = {genericStyles.subtitle}>{p.allMessages[47]}</Text>}

									{/*//Mensaje: "Introduzca su contraseña para confirmar"*/}
									{(s.definitivePassword == null) && <Text style = {genericStyles.subtitle}>{p.allMessages[48]}</Text>}

									{/*//Ingresar la contraseña*/}
									<View style = {{height: 20}}/>
									<View style = {genericStyles.row_instructions_textInput}>
										<TextInput 
											defaultValue      = {s.previousPasswordConfirmation}
											selectTextOnFocus = {true}
											textAlign         = {'center'} 
											placeholder       = {p.allMessages[12]} // Mensaje: "Rellenar campo..."
											style             = {genericStyles.textInput}
											secureTextEntry   = {true}	
											onChangeText      = {text => this.onChangePreviousPasswordConfirmation(text)}
											autoCapitalize    = "none"
										/>
									</View>						

								</ScrollView>
							</View>
						}

						{/*Vista de los botones para darle Aceptar o Volver*/}
						<View style = {genericStyles.down_buttons}>

							<View style = {{paddingRight: (s.connectionToServer ? 25 : 0)}}>
								<ButtonNoIcon 
									raised
									title   = {p.allMessages[33]} // Mensaje: "Volver"
									color   = {DARK_GRAY_COLOR}
									onPress = {() => {s.keyboardAvailable ? Keyboard.dismiss() : 
												(s.connectionToServer ? this.setModal_4_Visible(false) : 
													this.setState({modal_3_visible: false, modal_4_visible: false})
												)
									}}
								/>
							</View>

							{s.connectionToServer &&
								<View style = {{paddingLeft: 25}}>
									<ButtonWithIcon
										raised
										title   = {p.allMessages[46]} /// Mensaje: "Aceptar"
										icon    = {{name: 'check'}}
										onPress = {() => {s.keyboardAvailable ? Keyboard.dismiss() : this.acceptSettings()}}
									/>
								</View>
							}
						</View>
					</View>
				</Modal>
			</View>
		)
	}
}

/// Constante para darle formato a los diversos componentes de esta pantalla
const localStyles = StyleSheet.create({

	// Formato de la vista en la que se muestra una imagen con sus dimensiones originales (Modal 2)
	imageView: {
		flex:           1,
		flexDirection:  'column',
		paddingTop:     20, 
		paddingBottom:  15, 
		paddingRight:   15, 
		paddingLeft:    15,
		alignItems:     'center',
		justifyContent: 'center',
	},

	// Formato de los botones para capturar una nueva foto o para añadir desde galería
	buttonView: {
		flex:           1, 
		alignItems:     'center', 
		justifyContent: 'center', 
		padding:         15,
	},

	/* Formato del cuadro en donde irá el TouchableHighlight (aunque todavía no ejercerá acción) donde luego se mostrará la foto de perfil, 
	   encima de los botones de agregar desde galería y tomar nueva foto. También es el formato de la imagen ya creada*/
	touchableHighlight_WithBorder: {
		height:         0.7 * D.GLOBAL_SCREEN_WIDTH, 
		width:          0.7 * D.GLOBAL_SCREEN_WIDTH, 
		borderColor:    'black', 
		borderWidth:    1,
	},

	// Formato del TouchableHighlight en donde se muestra la foto de perfil, encima de los botones de agregar desde galería y tomar nueva foto
	touchableHighlight_NoBorder: {
		height:         0.7 * D.GLOBAL_SCREEN_WIDTH, 
		width:          0.7 * D.GLOBAL_SCREEN_WIDTH, 
	},

});

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages: UserForm_Texts[state.appPreferencesReducer.language], 
		user_id:     state.userReducer.user_id,
		localDB:     state.userReducer.localDB,
		remoteDB:    state.userReducer.remoteDB,
		privileges:  state.userReducer.privileges,
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchNewUser:         (user_id) => dispatch(changeUser(user_id)),
		dispatchUserName:        (userName) => dispatch(changeUserName(userName)),
		dispatchSyncHandler:     (syncFunction) => dispatch(changeSyncHandler(syncFunction)),
		dispatchNewProfileImage: (image) => dispatch(changeUserProfileImage(image)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(UserForm);