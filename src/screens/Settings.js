import React, { Component } from 'react';
import { StyleSheet, Text, View, Image, ActivityIndicator, Alert,
	     Button as ButtonNoIcon, ScrollView, Picker, TextInput } from 'react-native';

import { Button as ButtonWithIcon} from 'react-native-elements'

import * as Network from 'expo-network'

import { connect } from 'react-redux'
import { changeLanguage } from '../redux/actions/appPreferencesActions'
import { changeUser, changeUserName, changeUserProfileImage, changeUserPrivileges, changeSyncHandler } from '../redux/actions/userActions'
import { changeLithologyListLanguage, changeStructureListLanguage, changeFossilListLanguage,
         changeNoCarbonatesRuleLanguage, changeCarbonatesRuleLanguage } from '../redux/actions/libraryActions'

import {Settings_Texts} from '../languages/screens/Settings'
import * as Log         from '../genericFunctions/logFunctions'
import * as Database    from '../genericFunctions/databaseFunctions'
import {genericStyles}  from '../constants/genericStyles'
import { UNAUTHENTICATED_ID, PRIMARY_ADMINISTRATOR_ID, DEFAULT_DOCUMENT_ID, 
	     LOCAL_LITHODEX, REMOTE_GENERIC_LITHODEX, SERVER_IP, changeServerIp} from '../constants/appConstants'

import PouchDB from 'pouchdb-react-native'
PouchDB.plugin(require('pouchdb-adapter-asyncstorage').default);


const localLithodex = new PouchDB(LOCAL_LITHODEX, {auto_compaction: true, revs_limit: 1}); 

class Settings extends Component {

	constructor(props){
		super(props)
		this.state = {
			serverIp: SERVER_IP,
			loading:  false,
		}
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps }) => ({
		title:           Settings_Texts[screenProps.language][0],
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		}
	});

	// Para registrar en el "log" que se ha ingresado en el menú de configuración
	componentDidMount() {
		Log.log_action({entry_code: 2, user_id: this.props.user_id});
	}

	// Función para indicarle al usuario que ocurrió un error drante la ejecución de alguna operación
	alertError = () => {
		// Alerta: "Ocurrió un error"
		Alert.alert(this.props.allMessages[7], this.props.allMessages[11]);
		this.setState({loading: false});	
	}

	// Procedimiento para cambiar el idioma
	updateLanguage = (newLanguage) => {
		let p = this.props;
		// Actualizamos parámetros necesarios de acuerdo al nuevo idioma
		p.dispatchChangeLanguage(newLanguage); // Actualizamos el idioma en el estado global que se mantiene en la tienda de Redux
		p.dispatchChangeLithologyListLanguage(newLanguage); // Lista de litologías
		p.dispatchChangeStructureListLanguage(newLanguage); // Lista de estructuras sedimentarias 
		p.dispatchChangeFossilListLanguage(newLanguage); // Lista de fósiles
		p.dispatchChangeNoCarbonatesRuleLanguage(newLanguage); // Regla de los no carbonatos
		p.dispacthChangeCarbonatesRuleLanguage(newLanguage); // Regla de los carbonatos

		// Actualizamos el idioma en la base de datos para que cuando se vuelva a abrir la aplicación se tenga el mismo idioma con el que se cerró
		localLithodex.get(DEFAULT_DOCUMENT_ID)
			.then(function(document){
				document.language = newLanguage;
				return localLithodex.put({...document, _rev: document._rev});
			})
			.catch(function(error){
				console.error(error.toString());
			})
	}

	// Procedimiento para que un usuario se elimine a sí mismo del sistema
	deleteOwnUserFromDatabase = () => {
		let p = this.props;	

		// Procedimiento auxiliar que se invoca cuando se confirma que se desea eliminar el usuario del sistema
		let deleteOwnUserFromDatabaseAux = async(p) => {
			const {isInternetReachable, isConnected} = await Network.getNetworkStateAsync();

			// Esto garantiza que hay conexión a Internet, pero no que haya conexión con el servidor
			if (isInternetReachable && isConnected){
				try {
					this.setState({loading: true});
					const error = await Database.deleteUser(p.user_id, p.userName, p.remoteDB, p.localDB);

					// Si ocurrió un error en las bases de datos remotas, abortamos
					if (error){
						throw error;
					}

					// Restauramos los valores necesarios en la Tienda Redux
					p.dispatchChangeUser(UNAUTHENTICATED_ID); 
					p.dispatchResetUserName();
					p.dispatchResetUserPrivileges();
					p.dispatchResetProfileImage();
					p.dispatchResetSyncHandler();

					// Alerta: "El usuario ha sido eliminado satisfactoriamente"
					Alert.alert(p.allMessages[7], p.allMessages[6]);

					p.navigation.goBack();
				}
				catch(error){
					this.alertError();			
				}
			}
			else {
				this.alertError();
			}
		}

		// Alerta: "¿Seguro de que desea eliminar su usuario del sistema?"
		Alert.alert(p.allMessages[7], p.allMessages[10],
			[
				// Mensaje: "Sí"
				{text: p.allMessages[8], onPress: () => deleteOwnUserFromDatabaseAux(p)},
				// Mensaje: "No"
				{text: p.allMessages[9]},
			] 
		)
	}

	// Función que le permite al usuario cambiar la dirección IP del servidor del sistema
	async stablishServerIp(){
		let p = this.props;
		const newIp = this.state.serverIp;
		
		try{
			// Modificamos la variable global que tiene la IP
			await changeServerIp(newIp);

			// Guardamos la nueva IP en la base de datos local genérica
			localLithodex.get(DEFAULT_DOCUMENT_ID)
				.then(function (document){
					document.serverIp = newIp;
					return localLithodex.put({...document, _rev: document._rev});
				})

			if (p.user_id !== UNAUTHENTICATED_ID){
				// Despachamos el usuario nuevamente para que se modifique la dirección de su base de datos remota
				p.dispatchChangeUser(p.user_id);	
			}
				
			// Alerta: "Se modificó la dirección IP"
			Alert.alert(p.allMessages[7], p.allMessages[14]);
		} catch(error){
			this.alertError();
		}
	}

	// Lo que se le mostrará al usuario
	render (){
		let s = this.state;
		let p = this.props;

		if (s.loading){
			return(
				<View style = {{...genericStyles.simple_center, paddingTop: '15%'}}>
					<ActivityIndicator size = "large" color = "#0000ff" />
					{/*Mensaje: "Cargando"*/}
					<Text>{p.allMessages[3]}...</Text>
				</View>
			)
		}
		return (
			<View>
				<ScrollView>

					{/*Sección para seleccionar el idioma en el que se muestran los textos en la aplicación*/}
					<View style = {styles.container}>
						{/*Mensaje: "Seleccionar idioma"*/}
						<Text style = {styles.instructionTitle}>{p.allMessages[1]}</Text>
						<Picker
							selectedValue = {p.language}
							style         = {{height: 30, width: '31.25%'}}
							onValueChange = {(itemValue) => this.updateLanguage(itemValue)}
						>
							<Picker.Item label = {p.allMessages[2][0]}  value = {'spanish'}/>
							<Picker.Item label = {p.allMessages[2][1]}  value = {'english'}/>
						</Picker>
			      	</View>

					{/*Sección para modificar la dirección IP del servidor del sistema*/}
					<View style = {styles.container}>
						{/*Mensaje: "Modificar dirección IP del servidor"*/}
						<Text style = {styles.instructionTitle}>{p.allMessages[12]}</Text>

						<View style = {{...genericStyles.simple_center, flexDirection: 'row', width: '80%'}}>
							<TextInput 
								defaultValue      = {s.serverIp}
								selectTextOnFocus = {true}
								textAlign         = {'center'} 
								style             = {genericStyles.textInput}
								placeholder       = {p.allMessages[13]} /// Mensaje: "Ej: 200.10.20.110"
								onChangeText      = {text => this.setState({serverIp: text})}
								keyboardType      = 'phone-pad'
							/>
							<View style = {{height: 35, flexDirection: 'row'}}>
								<ButtonWithIcon
									raised
									icon  = {{name: 'done', color: 'white'}}
									onPress = {() => {this.stablishServerIp()}}
								/>
							</View>
						</View>
					</View>

					{/*//Sección para eliminar su propio usuario. El no autenticado no puede borrarse a sí mismo, ni tampoco el administrador primario, que es el administrador
					   que viene por defecto en el sistema, puesto que siempre necesitamos que haya al menos un administrador*/}
					{ (p.user_id != PRIMARY_ADMINISTRATOR_ID) && (p.user_id != UNAUTHENTICATED_ID) &&
						<View style = {styles.container}>
							{/*//Mensaje: "Eliminar usuario propio del sistema"*/}
							<Text style = {styles.instructionTitle}>{p.allMessages[4]}</Text>
							<ButtonNoIcon
								title   = {p.allMessages[5]} /// Mensaje: "Eliminar"
								color   = 'red'
								onPress = {() => this.deleteOwnUserFromDatabase()}
							/>
						</View>
					}

		      	</ScrollView>
      		</View>
		);
	}
}

/// Variable para darle formato a los diversos componentes de esta pantalla
const styles = StyleSheet.create({

	// Empleado para dividir por secciones cada una de las funciones de esta vista.
	container: {
		height:         110,
		alignItems:     'center',
		justifyContent: 'center',
	},

	// Empleado para mostrar el texto que indica el tipo de instrucción
	instructionTitle: {
		alignItems:     'flex-start',
		justifyContent: 'flex-start',
		fontWeight:     'bold',
		fontSize:       17,
		padding:        10,
		paddingTop:     20,
		textAlign:      'center'
	},

});

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		language:    state.appPreferencesReducer.language,
		allMessages: Settings_Texts[state.appPreferencesReducer.language],
		user_id:     state.userReducer.user_id,
		localDB:     state.userReducer.localDB,
		remoteDB:    state.userReducer.remoteDB,
		userName:    state.userReducer.userName,
		syncHandler: state.userReducer.syncHandler,
		privileges:  state.userReducer.privileges,
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchChangeUser:   (user_id) => dispatch(changeUser(user_id)),
		dispatchResetUserName:       () => dispatch(changeUserName(null)),
		dispatchResetUserPrivileges: () => dispatch(changeUserPrivileges(0)),
		dispatchResetSyncHandler:    () => dispatch(changeSyncHandler(null)),
		dispatchResetProfileImage:   () => dispatch(changeUserProfileImage(null)),

		dispatchChangeLanguage: (language) => dispatch(changeLanguage(language)),
		dispatchChangeLithologyListLanguage:    (language) => dispatch(changeLithologyListLanguage(language)),
		dispatchChangeStructureListLanguage:    (language) => dispatch(changeStructureListLanguage(language)),   
		dispatchChangeFossilListLanguage:       (language) => dispatch(changeFossilListLanguage(language)),
		dispatchChangeNoCarbonatesRuleLanguage: (language) => dispatch(changeNoCarbonatesRuleLanguage(language)), 
		dispacthChangeCarbonatesRuleLanguage:   (language) => dispatch(changeCarbonatesRuleLanguage(language)), 
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(Settings)