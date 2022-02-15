import React, { Component } from 'react';
import { View } from 'react-native';

// Importamos los archivos de redux
import { Provider } from 'react-redux'
import { connect } from 'react-redux'
import { createAppContainer }   from 'react-navigation';
import { createStackNavigator } from 'react-navigation-stack';   

import configureStore from './src/redux/store/configureStore' // Función creada por nosotros para obtener nuestra tienda Redux  

// Importamos los archivos de base de datos
import * as Database  from './src/genericFunctions/databaseFunctions'

// Aquí importamos todas las ventanas creadas
import * as Screens from './src/screens'


// Aquí establecemos cuáles serán las ventanas que tendrá nuestra aplicación
const AppStackNavigator = createStackNavigator({

	// Vista inicial en la que el usuario tiene la opción de dirigirse a cualquiera de las galerías, 
	// ir al menú de configuración, e ir a la información de la aplicación
	MainMenu: {screen: Screens.MainMenu},

	// -------------------------- Vistas más externas ------------------------------

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

	// --------------------- Vistas referentes a afloramientos ----------------------

	// Vista donde se despliegan todos los afloramientos creados por el usuario actual
	OutcropGallery: {screen: Screens.OutcropGallery},

	// Vista donde el usuario rellena los campos de un nuevo afloramiento
	OutcropForm: {screen: Screens.OutcropForm},

	// Aquí se despliegan los estratos de un afloramiento
	OutcropScreen: {screen: Screens.OutcropScreen},

	// Vista donde el usuario rellena los campos de un nuevo estrato de un afloramiento
	OutcropStratumForm: {screen: Screens.OutcropStratumForm},

	// ----------------------- Vistas referentes a núcleos --------------------------

	// Vista donde se despliegan todos los núcleos creados por el usuario actual
	CoreGallery: {screen: Screens.CoreGallery},

	// Vista donde el usuario rellena los campos de un nuevo núcleo
	CoreForm: {screen: Screens.CoreForm},

	// Aquí se despliega la gráfica de un núcleo
	CoreScreen: {screen: Screens.CoreScreen},

	// Vista donde el usuario rellena los campos de un nuevo estrato de núcleo
	CoreStratumForm: {screen: Screens.CoreStratumForm},

	// ------------------ Vistas referentes a contactar otros usuarios ---------------

	// Módulo que tiene varias vistas referentes a contactar a otros usuarios
	ContactUsersRootComponent: {screen: Screens.ContactUsersRootComponent},

	// Vista en la que un usuario ve la información de otro usuario, pudiendo añadirlo como amigo o enviarle un mensaje
	UserView: {screen: Screens.UserView},
});

const AppStackContainer = createAppContainer(AppStackNavigator);


export default class App extends Component {

	constructor(props) {
		super(props)
		Database.new_database()
	}

	render() {
		let store      = configureStore(); // Tienda Redux creada por nosotros
		let reduxState = store.getState(); /* "getState" es una función predeterminada de la herramienta 
		                                       que nos da el estado, es decir, el árbol de reductores de la Tienda */

		return (
			<View style = {{flex:1}}>
				<Provider store = {store}>
					<AppStackContainer 
						screenProps = {{ // Todo lo que coloquemos en screenProps será compartido por todas las vistas que pertenezcan a AppStackContainer
							language:        reduxState.appPreferencesReducer.language,
							headerTintColor: reduxState.appPreferencesReducer.headerTintColor,
							headerBackgroundColor: reduxState.appPreferencesReducer.headerBackgroundColor, 
						}}
					/>
				</Provider>
			</View>
		);
	}
}