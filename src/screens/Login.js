import React, { Component } from 'react';
import { Text, View, StyleSheet, TextInput, Button as ButtonNoIcon, 
		ScrollView, Alert, ActivityIndicator, Keyboard} from 'react-native'

import {Button as ButtonWithIcon, CheckBox} from 'react-native-elements'

import { connect } from 'react-redux'
import { changeUser, changeUserName, changeUserProfileImage, 
	     changeUserPrivileges, changeSyncHandler } from '../redux/actions/userActions'

import { Login_Texts } from '../languages/screens/Login'
import { genericStyles, DARK_GRAY_COLOR }  from '../constants/genericStyles'
import { remoteLithodex, LOCAL_LITHODEX, SERVER_URL, UNAUTHENTICATED_ID, DEFAULT_DOCUMENT_ID,
		 USERS_TABLES_DOCUMENT_ID, OUTCROPS_DOCUMENT_ID, CORES_DOCUMENT_ID } from '../constants/appConstants'

import * as Network from 'expo-network'
import { acquireUnauthenticatedImages, deleteConflictingRevisions } from '../genericFunctions/databaseFunctions'
import { exportLogEntries } from '../genericFunctions/logFunctions'

import PouchDB from 'pouchdb-react-native'
PouchDB.plugin(require('pouchdb-adapter-asyncstorage').default);


class Login extends Component {

	constructor(props) {
		super(props)
		this.keyboardDidShow = this.keyboardDidShow.bind(this)
		this.keyboardDidHide = this.keyboardDidHide.bind(this)

		this.state = {
			userName: null,
			password: null,
			acquireInformation: false, // Determina si hay que adquirir la información del usuario no autenticado

			// Determina si el teclado está visible. Esto lo pusimos porque no queremos que los botones de "Aceptar" y "Cancelar" de la parte inferior cierren la vista cuando el teclado está visible
			keyboardAvailable: false,

			// Determina si están dispoibles los botones de Aceptar y Cancelar
			buttonsEnabled: true,

			// Determina si se está cargando el usuario desde la base de datos remota
			loading: false,
		}
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps }) => ({
		title:           Login_Texts[screenProps.language][5],
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		}
	});

	// Aquí inicializamos los escuchas que determinan si el teclado se está mostrando o no
	componentDidMount(){
		this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow);
		this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide);

		this.setState({userName: "ronald", password: "111111"});
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

	// Procedimiento para actualizar el nombre de usuario
	onChangeUserName = (text) => {
		this.setState({userName: text});	
	}

	// Procedimiento para actualizar la contraseña
	onChangePassword = (text) => {	
		this.setState({password: text});
	}

	// Función para verificar si el par (nombre de usuario, contraseña) existe en la base de datos
	verifyUserExistence = async(userName,password) =>{
		var currentUser = null;
		var returnedValue = {userAndPasswordMatch: false, connectionToServer: false};

		await remoteLithodex.get(USERS_TABLES_DOCUMENT_ID)
			.then(async function(document){ 
				// Buscamos el usuario que coincida con el nombre de usuario provisto
				let currentUser = document.userNames[userName];

				if (currentUser != null){
					let passwordToCompare;
					let noError = true;

					const userDB = new PouchDB(SERVER_URL + currentUser._id); // Base de datos remota del usuario
					await userDB.get(DEFAULT_DOCUMENT_ID)
						.then(function(document){
							passwordToCompare = document.password;
						})
						.catch(function(error){
							noError = false;
							returnedValue.connectionToServer = false;
						})
					if (noError){
						returnedValue = {
							userAndPasswordMatch: (password === passwordToCompare),
							_id: currentUser._id,
							connectionToServer: true,
						};
					}
				} else {
					 returnedValue.connectionToServer = true; 
				}
			}).catch(function(error){});
		return returnedValue;
	}

	// Para mostrar el mensaje de que ocurrió un error cuando se intentaba conectar con el servidor, y además permitirle al usuario interactuar
	// de nuevo en esta ventana
	noConnectionMessage = () => {
		let p = this.props;
		// Alerta: "Ocurrió un error"
		Alert.alert(p.allMessages[8], p.allMessages[10]);
		this.setState({buttonsEnabled: true, loading: false})
	}

	// Se activa cuando el usuario le da al botón de "Aceptar", y determina si hay que añadir un nuevo estrato, o se modifica uno ya existente
	acceptSettings = async() => {
		const {isInternetReachable, isConnected} = await Network.getNetworkStateAsync();
		let s = this.state;
		let p = this.props;

		if (isInternetReachable && isConnected){
			this.setState({buttonsEnabled: false, loading: true})
			const result = await this.verifyUserExistence(s.userName,s.password);

			if (result.connectionToServer){
				if (!result.userAndPasswordMatch){
					// Alerta: "Usuario o contraseña incorrectos"
					Alert.alert(p.allMessages[8], p.allMessages[0]);
					this.setState({buttonsEnabled: true, loading: false})
				}
				else {
					try {
						// Tenemos que hacer que el usuario actual en Redux sea el que se ingresó
						await p.dispatchUser(result._id);

						// Al haber despachado el usuario ya podemos invocar sus respectivas bases de datos
						// Hacemos que la local adquiera todo lo salvado en la remota
						// Nótese que esta replicación es unidireccional: remota => local.
						// Como no le pasamos la opción "live:true", entonces esta replicación se hará una sola vez
						var syncHandlerProv = await this.props.localDB.replicate.from(this.props.remoteDB); 

						// Necesitamos estas variables para luego almacenarlas en la base de datos genérica local y también para despacharlas a la Tienda Redux.
						// Las obtenemos de la base de datos del usuario.
						let profileImage, privileges, userName; 
						await this.props.localDB.get(DEFAULT_DOCUMENT_ID)
							.then(async(document) => {
								profileImage = document.information.profileImage;
								privileges   = document.privileges;
								userName     = document.userName;
							}).catch(error => {
								console.error(error.toString());
								this.props.localDB.destroy(); // Como la replicación fue remota => local, esto sólo destruye la base de datos local
								p.dispatchUser(UNAUTHENTICATED_ID);
								p.navigation.goBack();
							})

						// En la base de datos genérica local tenemos que actualizar la información del usuario actual
						const localLithodex = new PouchDB(LOCAL_LITHODEX, {auto_compaction: true, revs_limit: 1}); 
						localLithodex.get(DEFAULT_DOCUMENT_ID)
							.then(document => {
								let cu = document.currentUser;
								cu._id = result._id;
								cu.privileges = privileges;
								cu.profileImage = profileImage;
								cu.userName = userName;
								return localLithodex.put({...document, _rev: document._rev});
							}).catch(error => {
								console.error(error.toString());
								this.props.localDB.destroy(); // Como la replicación fue remota => local, esto sólo destruye la base de datos local
								p.dispatchUser(UNAUTHENTICATED_ID);
								p.navigation.goBack();
							})

						if (this.props.user_id !== UNAUTHENTICATED_ID){
							// Despachamos las variables ya mencionadas a la Tienda Redux
							p.dispatchProfileImage(profileImage); // Imagen de perfil
							p.dispatchUserPrivileges(privileges); // Privilegios del usuario
							p.dispatchUserName(userName); // Nombre de usuario

							// Caso en que tenemos que transferirle al usuario autenticado lo que realizó el no autenticado
							if (s.acquireInformation){
								const unauthenticatedDB = await new PouchDB(UNAUTHENTICATED_ID, {auto_compaction: true, revs_limit: 1});

								// Adquirimos todo lo necesario del documento de afloramientos del usuario no autenticado
								await unauthenticatedDB.get(OUTCROPS_DOCUMENT_ID)
									.then(async(unauthenticated_document) => {
										await this.props.localDB.get(OUTCROPS_DOCUMENT_ID)
											.then(async(user_document) => {
												user_document.objects = await {...user_document.objects, ...unauthenticated_document.objects};
												user_document.log     = await user_document.log.concat(unauthenticated_document.log);
												return this.props.localDB.put({...user_document, _rev: user_document._rev});
											})
										unauthenticated_document.objects = {};
										unauthenticated_document.log     = [];
										return unauthenticatedDB.put({...unauthenticated_document, _rev: unauthenticated_document._rev});
									})

								// Adquirimos todo lo necesario del documento de núcleos del usuario no autenticado
								await unauthenticatedDB.get(CORES_DOCUMENT_ID)
									.then(async (unauthenticated_document) => {
										await this.props.localDB.get(CORES_DOCUMENT_ID)
											.then(async(user_document) => {
												user_document.objects = await {...user_document.objects, ...unauthenticated_document.objects};
												user_document.log     = await user_document.log.concat(unauthenticated_document.log);
												return this.props.localDB.put({...user_document, _rev: user_document._rev});
											})
										unauthenticated_document.objects = {};
										unauthenticated_document.log     = [];
										return unauthenticatedDB.put({...unauthenticated_document, _rev: unauthenticated_document._rev});
									})

								// Adquirimos los documentos referentes a imágenes
								await acquireUnauthenticatedImages(this.props.localDB);
							}

							// Ahora transferimos a la base remota del usuario todo lo que se pudo haber mantenido en una local del usuario y que no 
							// se llegó a replicar quizás por problemas de conexión
							syncHandlerProv = await this.props.localDB.replicate.to(this.props.remoteDB);

							// Si todo lo anterior se hizo correctamente, ahora sí establecemos una sincronización bidireccional, la cual guardamos
							// en la Tienda Redux para poder cancelarla desde otro archivo cuando queramos cerrar sesión haciendo "this.props.syncHandler.cancel()"
							p.dispatchSyncHandler(
								PouchDB.sync(this.props.localDB,this.props.remoteDB, {
									live: true, // Hace que la replicación continúe indefinidamente, en lugar de hacerse una sola vez
									retry: true // Si el usuario pierde la conexión, "retry" hace que la replicación se reanude una vez dicha conexión se reestablezca
								}).on('active', async(info) => {
									// Cada vez que la replicación esté activa nuevamente tenemos que transferir las entradas necesarias del log
									// Esto obliga a que cada archivo de vista tenga acceso a la propiedad "user_id" de la Tienda Redux
									exportLogEntries(this.props.user_id, this.props.remoteDB);
								})
							);

							// Alerta: "Se ha iniciado sesión como '<Nombre de usuario>'"
							Alert.alert(p.allMessages[8], p.allMessages[7]+s.userName+"'");
							p.navigation.goBack();
						}
					} catch(error){
						console.error(error.toString());
						this.noConnectionMessage();
						if (this.props.user_id !== UNAUTHENTICATED_ID){
							if (this.props.syncHandler !== null){
								await this.props.syncHandler.cancel();
								p.dispatchSyncHandler(null);
							}
							this.props.localDB.destroy();
							p.dispatchUser(UNAUTHENTICATED_ID);
						}
					}
				}
			} else {
				this.noConnectionMessage();
			}
		}
		else {
			this.noConnectionMessage();
		}
	}

	// Procedimiento para el caso en que el usuario le da al botón de Cancelar
	refuseSettings = () => {
		this.setState({buttonsEnabled: false})
		this.props.navigation.goBack();
	}

	// Lo que se muestra al usuario en total en esta ventana
	render (){
		let s = this.state;
		let p = this.props;

		if (s.loading){
			return(
				<View style = {genericStyles.simple_center}>
					<ActivityIndicator size = "large" color = "#0000ff" />
					{/*Mensaje: "Cargando"*/}
					<Text>{p.allMessages[9]}...</Text>
				</View>
			)
		}

		return(
			<View style = {genericStyles.lightGray_background}>

				{/*En esta parte el usuario ingresa el nombre de usuario y la contraseña*/}
				<View style = {genericStyles.white_background_with_ScrollView}>
					
					<ScrollView>

						{/*Ingresar el nombre de usuario*/}
						<View style = {localStyles.row_instructions_textInput}>
							{/*Mensaje: "Nombre de usuario :  "*/}
							<Text style = {{flex: 1, color: 'red', fontWeight: 'bold'}}>*
								<Text style = {{color: 'black'}}> {p.allMessages[1]}</Text>
							</Text>
							<TextInput 
								defaultValue      = {s.userName}
								selectTextOnFocus = {true}
								textAlign         = {'center'} 
								style             = {genericStyles.textInput}
								onChangeText      = {text => this.onChangeUserName(text)}
								autoCapitalize    = "none"
							/>
						</View>

						{/*Ingresar la contraseña*/}
						<View style = {localStyles.row_instructions_textInput}>
							{/*Mensaje: "Contraseña : "*/}
							<Text style = {{flex: 1, color: 'red', fontWeight: 'bold'}}>*
								<Text style = {{color: 'black'}}> {p.allMessages[2]}</Text>
							</Text>
							<TextInput
								defaultValue      = {s.password}
								selectTextOnFocus = {true}
								textAlign         = {'center'} 
								secureTextEntry   = {true}
								style             = {genericStyles.textInput}
								onChangeText      = {text => this.onChangePassword(text)}
								autoCapitalize    = "none"
							/>
						</View>

						<View style = {{paddingTop: 50, paddingBottom: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
							<CheckBox // Cuadro que le permite al usuario determinar si quiere llevarse la información que había guardado como usuario no autenticado
								title   = {p.allMessages[6]} // Mensaje: "Adquirir información del usuario no autenticado"
								checked = {s.acquireInformation}
								onPress = {() => {this.setState({acquireInformation: !s.acquireInformation})}}
							/>
						</View>

					</ScrollView>

				</View>

				{/*//Vista de los botones para darle Aceptar o Cancelar*/}
				<View style = {genericStyles.down_buttons}>

					<View style = {{paddingRight: 25}}>
						<ButtonNoIcon 
							raised
							title   = {p.allMessages[3]} // Mensaje: "Cancelar"
							color   = {DARK_GRAY_COLOR}
							onPress = {this.state.buttonsEnabled ? () => {s.keyboardAvailable ? Keyboard.dismiss() : this.refuseSettings()} : () => {}}
						/>
					</View>

					<View style = {{paddingLeft: 25}}>
						<ButtonWithIcon
							raised
							title   = {p.allMessages[4]} /// Mensaje: "Aceptar"
							icon    = {{name: 'check'}}
							onPress = {this.state.buttonsEnabled ? () => {s.keyboardAvailable ? Keyboard.dismiss() : this.acceptSettings()} : () => {}}	
						/>
					</View>
				</View>
			</View>
		)
	}
}

/// Constante para darle formato a los diversos componentes de esta pantalla 
const localStyles = StyleSheet.create({

	// Estilo de cada una de las dos filas de esta vista: la primera para ingresar el nombre de usuario, y la segunda para ingresar la contraseña
	row_instructions_textInput: {
		flex:           1,
		flexDirection:  'row',
		justifyContent: 'center',
		alignItems:     'center',
		padding:        10,
		paddingTop:     30,
		paddingBottom:  10,
	},
});

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages: Login_Texts[state.appPreferencesReducer.language],
		user_id:     state.userReducer.user_id,
		localDB:     state.userReducer.localDB,
		remoteDB:    state.userReducer.remoteDB,
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchUser: (user_id) => dispatch(changeUser(user_id)),
		dispatchUserName: (userName) => dispatch(changeUserName(userName)),
		dispatchProfileImage: (image) => dispatch(changeUserProfileImage(image)),
		dispatchUserPrivileges: (privileges) => dispatch(changeUserPrivileges(privileges)),
		dispatchSyncHandler: (syncFunction) => dispatch(changeSyncHandler(syncFunction)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(Login)