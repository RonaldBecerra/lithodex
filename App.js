import React, { Component } from 'react';
import { View } from 'react-native';

// Importamos los archivos de redux
import { Provider } from 'react-redux'
import configureStore from './src/redux/store/configureStore' // Función creada por nosotros para obtener nuestra tienda Redux  

import * as Database  from './src/genericFunctions/databaseFunctions'
import RootComponent from './RootComponent'


// Store de Redux
const store = configureStore();


/* Originalmente, en este mismo código se creaba el AppNavigator y el AppContainer, y el AppContainer
 lo invocábamos en donde ahora se hace la llamada a <RootComponent/>. Sin embargo, los movimos al archivo
 separado RootComponent.js.

 Eso se debe a que el AppStackContainer que creamos en ese archivo recibe unos parámetros a través de screenProps que deben actualizarse
 cuando ocurre un cambio en ellos en la Tienda Redux. Tenerlos en ese archivo aparte permite visualizar esos cambios porque accedemos a
 ellos a través de la función connect, lo cual no puede hacerse aquí porque apenas aquí es cuando estamos creando la Tienda.

 Esta solución se logró basándose en:
 https://github.com/react-navigation/react-navigation/issues/2435
 */

 export default class App extends Component {

	constructor(props) {
		super(props)
		this.state = {
			dontRender: true,
		}
	}

	async componentDidMount(){
		await Database.new_database();
		this.setState({dontRender: false})
	}

	render() {
		if (this.state.dontRender){
			return (<View/>)	
		}
		/* Se intentó crear en esta misma vista el AppStackContainer de RootComponent e invocarlo aquí donde se invoca RootComponent.
		    Para obtener los datos de la Tienda Redux que luego se le pasan como parámetros en "screenProps", se usaba la función
		    store.getState(), que nos permite obtener el estado (árbol de reductores) de la Tienda. Pero como ya se dijo, de esa forma
		    no se actualizaban los datos de screenProps cuando en la Tienda Redux cambiaba alguno de esos parámetros */
		return (
			<View style = {{flex:1}}>
				<Provider store = {store}>
					<RootComponent/>
				</Provider>
			</View>
		);
	}
}