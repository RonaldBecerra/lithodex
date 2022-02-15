import React, { Component } from 'react';
import { View, Text } from 'react-native';

import { createAppContainer }   from 'react-navigation';
import { createStackNavigator } from 'react-navigation-stack';

import * as Permissions from 'expo-permissions'

// Importamos los archivos de redux
import { connect } from 'react-redux'
import { changeLanguage } from './src/redux/actions/appPreferencesActions'
import { changeUser, changeUserName, changeUserProfileImage, changeUserPrivileges, changeSyncHandler } from './src/redux/actions/userActions'

import * as Screens from './src/screens' // Aquí importamos todas las ventanas creadas

import globalTest from './src/globalTest'

import PouchDB from 'pouchdb-react-native'
import { DEFAULT_DOCUMENT_ID, LOCAL_LITHODEX, changeServerIp } from './src/constants/appConstants'

import { exportLogEntries } from './src/genericFunctions/logFunctions'


// Aquí establecemos cuáles serán las ventanas que tendrá nuestra aplicación
const AppStackNavigator = createStackNavigator({

	// Vista inicial en la que el usuario tiene la opción de dirigirse a cualquiera de las galerías, 
	// ir al menú de configuración, ir a la información de la aplicación, consultar el log, o ir al módulo de contactar usuarios.
	MainMenu: {screen: Screens.MainMenu},

	// ----------------------------- Vistas genéricas -------------------------------

	// Formulario en el que el usuario rellena sus datos
	UserForm: {screen: Screens.UserForm},

	// Formulario en el que el usuario inicia sesión
	Login: {screen: Screens.Login},

	// Información de esta aplicación, como los profesores tutores y los desarrolladores
	AboutLithoDex: {screen: Screens.AboutLithoDex},

	// Aquí el usuario tiene la opción de configurar la aplicación, como borrar la base de datos completa, cambiar el idioma, etc.
	Settings: {screen: Screens.Settings},

	// Aquí se ve la localización de un afloramiento o de un núcleo en Google Maps
	GoogleMaps: {screen: Screens.GoogleMaps},

	// Aquí el administrador tiene la capacidad de visualizar el "log"
	ConsultLog: {screen: Screens.ConsultLog},

	// ----- Vistas referentes a objetos de estudio : afloramientos o núcleos -------

	// Vista donde se despliegan todos los afloramientos o núcleos creados por el usuario actual
	ObjectGallery: {screen: Screens.ObjectGallery},

	// Vista donde el usuario rellena los campos de un nuevo afloramiento o núcleo
	ObjectForm: {screen: Screens.ObjectForm},

	// Vista donde el usuario rellena los campos de un nuevo afloramiento o núcleo
	ObjectScreen: {screen: Screens.ObjectScreen},

	// Vista donde el usuario rellena los campos de un nuevo estrato de un afloramiento o núcleo
	ObjectStratumForm: {screen: Screens.ObjectStratumForm},

	// ---------------- Vistas referentes a contactar otros usuarios -----------------

	// Módulo que tiene varias vistas referentes a contactar a otros usuarios
	ContactUsersRootComponent: {screen: Screens.ContactUsersRootComponent},

	// Vista en la que un usuario ve la información de otro usuario, pudiendo añadirlo como amigo o enviarle un mensaje
	UserView: {screen: Screens.UserView},
});

const AppStackContainer = createAppContainer(AppStackNavigator);


/* Si no se quiere que se utilicen los valores iniciales de la tienda de Redux sino que por el contrario se desea que al iniciar la aplicación
   se carguen algunos datos desde la base de datos y se despachen a la tienda, ésta es la clase en la que se debe hacer */
class RootComponent extends Component {

	constructor(props) {
		super(props)
		this.state = {
			loading:        true,
			currentIp:      null,
			testsFulfilled: false,
		}
	}

	async componentDidMount() {
		// Aquí verificamos si se pasaron todas las pruebas
		let testsFulfilled = await globalTest();
		this.setState({testsFulfilled})

		// Aquí solicitamos permisos de localización. Es necesario que estén aprobados porque el "log" siempre utiliza la ubicación actual,
		// y no queremos que el usuario rechace esos permisos cuando se va a registrar una nueva entrada de dicho "log"
		const { status } = await Permissions.askAsync(Permissions.LOCATION);
		const permissionsGranted = (status === 'granted');

		this.setState({permissionsGranted});

		if ((testsFulfilled) && permissionsGranted){

			// Actualizamos datos de la aplicación local según se hayan guardado en la base de datos del dispositivo
			const localLithodex = new PouchDB(LOCAL_LITHODEX); 
			await localLithodex.get(DEFAULT_DOCUMENT_ID)
				.then(document => {
					// La "ip" del servidor remoto será la misma que el usuario indicó la última vez. (Nótese que no la estamos almacenando en la Tienda Redux)
					changeServerIp(document.serverIp);

					// El idioma en la aplicación será el mismo usado la última vez
					this.props.dispatchChangeLanguage(document.language); 

					// Se mantiene el mismo usuario que estaba activo antes de cerrar la aplicación
					let cu = document.currentUser;
					this.props.dispatchUser(cu._id);
					this.props.dispatchUserName(cu.userName);
					this.props.dispatchProfileImage(cu.profileImage);
					this.props.dispatchUserPrivileges(cu.privileges);

					// Restablecemos el log local
					cu.log = [];
					cu.log_length = 0;

					// Esto para que nuevamente haya una sincronización entre la base de datos local y la remota en caso de que
					// haya un usuario autenticado
					if (this.props.remoteDB !== null){
						this.props.dispatchSyncHandler(
							PouchDB.sync(this.props.localDB,this.props.remoteDB, {
								live: true,  // Hace que la replicación continúe indefinidamente, en lugar de hacerse una sola vez
								retry: true, // Si el usuario pierde la conexión, "retry" hace que la replicación se reanude una vez dicha conexión se reestablezca
							}).on('active', (info) => {
								// Cada vez que la replicación esté activa nuevamente tenemos que transferir las entradas necesarias del log
								exportLogEntries(this.props.user_id, this.props.remoteDB);
							})
						)
					}
					return localLithodex.put({...document, _rev: document._rev});
				}).catch(function (error){
					console.error("RootComponent ", error.toString());
				})
			this.setState({loading: false}); // Aquí le indicamos a "render" que ya puede comenzar a mostrar la aplicación (o un mensaje de error)
		} 
		else {
			this.setState({loading: false}); // Aquí le indicamos a "render" que ya puede comenzar a mostrar la aplicación (o un mensaje de error)
		}
	}

	render() {
		if (this.state.loading){
			return ( <View/> )
		}

		if (this.state.testsFulfilled){
			if (this.state.permissionsGranted){
				return (
					<AppStackContainer 
						screenProps = {{
							language:              this.props.language,
							headerTintColor:       this.props.headerTintColor, 
							headerBackgroundColor: this.props.headerBackgroundColor,

							/* Esto sirve para darle un título a una vista en la cabecera cuando no estamos ubicados en una vista del navegador de pila
							   y, por lo tanto, no podemos establecr un título de la forma convencional. Por ejemplo, esto sucede cuando estamos en las
							   vistas del Drawer Navigator */
							headerTitle: this.props.headerTitle,

							/* Esta función sirve para aplicarla en la cabecera de una vista. Recuérdese que en las cabeceras sólo
							   tenemos acceso a "screenProps", "navigation" y "navigationOptions", por lo que en una vista respectiva
							   la cabecera no tendrá acceso a ninguno de sus métodos a través de "this". Así que la despachamos con Redux

							   Ahora bien, esta variable en realidad almacena un objeto JavaScript con una propiedad 'ref' en la cual es que
							   realmente estará la función, ya que si la almacenara a ella directamente, la aplicación consideraría que 
							   constantemente se está actualizando el estado de la tienda Redux*/
							stackFunction: this.props.stackFunction, 
						}}
					/>
				)
			}
			// Caso en que no se concedieron los permisos de localización
			return(
				<View style = {{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
					<Text style = {{textAlign: 'center'}}>The application could not be initialized</Text>
				</View>
			)
		}
		// Caso en que no fueron satisfechas todas las pruebas
		return(
			<View style = {{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
				<Text style = {{textAlign: 'center'}}>Not all the tests were fulfilled</Text>
			</View>
		)
	}
}

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		language:              state.appPreferencesReducer.language, 
		headerTintColor:       state.appPreferencesReducer.headerTintColor, 
		headerBackgroundColor: state.appPreferencesReducer.headerBackgroundColor,
		headerTitle:           state.popUpReducer.headerTitle,
		stackFunction:         state.popUpReducer.stackScreenPropsFunction,
		user_id:               state.userReducer.user_id,
		localDB:               state.userReducer.localDB,
		remoteDB:              state.userReducer.remoteDB,
		syncHandler:           state.userReducer.syncHandler,
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchChangeLanguage: (language) => dispatch(changeLanguage(language)),
		dispatchUser:           (user_id)  => dispatch(changeUser(user_id)),
		dispatchUserName:       (userName) => dispatch(changeUserName(userName)),
		dispatchProfileImage:   (image) => dispatch(changeUserProfileImage(image)),
		dispatchUserPrivileges: (privileges) => dispatch(changeUserPrivileges(privileges)),
		dispatchSyncHandler:    (syncFunction) => dispatch(changeSyncHandler(syncFunction)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(RootComponent);