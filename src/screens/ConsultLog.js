import React, { Component } from 'react';
import { Text, View, Button as ButtonNoIcon, ScrollView, ActivityIndicator } from 'react-native';

import { Button as ButtonWithIcon } from "react-native-elements"
import * as Network from 'expo-network'
import { connect } from 'react-redux'

import { ConsultLog_Texts } from '../languages/screens/ConsultLog'
import { genericStyles, DARK_GRAY_COLOR } from '../constants/genericStyles'
import { remoteLithodex, LOG_DOCUMENT_ID } from '../constants/appConstants'


// Máxima cantidad de veces que se puede volver a intentar cargar automáticamente los datos desde la base de datos.
const MAXIMUM_RETRIES_LOADING = 3; 

class ConsultLog extends Component {

	constructor(props) {
		super(props)

		this.state = {
			loading: true, // Booleano que determina si se está intentando leer desde la base de datos
			timesTryingLoading: 0,    // Cantidad de veces que se ha intentado leer los datos desde la base de datos, sin éxito
			loadFunctionOpened: true, // Indica si se puede ingresar a la función loadData

			completeLog: null,
		}
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps }) => ({
		title:           ConsultLog_Texts[screenProps.language][0],
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		}
	});

	// Procedimiento para contablizar un intento fallido de leer la base de datos
	failureReadingDatabase(){
		let timesTryingLoading = this.state.timesTryingLoading;

		if (timesTryingLoading < MAXIMUM_RETRIES_LOADING){
			this.determineConnection(true);	
			timesTryingLoading += 1;
			this.setState({timesTryingLoading});
		}					
	}

	// Función para cargar el "log" desde la base de datos
	async loadLog(verifyConnection = true){	
		if (verifyConnection){
			await this.determineConnection();
		}

		if (this.state.connectionToServer){
			await remoteLithodex.get(LOG_DOCUMENT_ID)
				.then(async(document) => {
					await this.setState({completeLog: document.log});
				})
				.catch(error => {
					this.failureReadingDatabase();
				})
		}
		else {
			this.failureReadingDatabase();
		}
		this.setState({loading: false, loadFunctionOpened: true, timesTryingLoading: 0});
	}

	// Esto determina si hay conexión a Internet o no
	async determineConnection(executeLoadLog){
		const {isInternetReachable, isConnected} = await Network.getNetworkStateAsync();
		const connectionToServer = isInternetReachable && isConnected;
		await this.setState({connectionToServer});

		if (connectionToServer && executeLoadLog){
			this.loadLog(false);
		}
	}

	// Función para mostrar el log
	renderLog(){
		return this.state.completeLog.map((item,i) => (
			<View key={i}>
				<Text>{JSON.stringify(item)}{"\n"}</Text>			
			</View>
		))
	}

	// Sirve para activar la función que lee desde la base de datos. Esto es útil cuando estamos emulando la aplicación y refrescamos la página
	// en caliente, ya que hacer eso volverá a colocar this.state.loading en su valor inicial (true) pero este componente ya estará montado, por lo que 
	// no se activará el NavigationEvents onWillFocus, y en consecuencia la vista se quedará pegada en "Cargando"
	activateLoadLog(){
		if (this.state.loadFunctionOpened){
			this.setState({loadFunctionOpened: false}, () => this.loadLog());
		}
		return(<View/>)
	}

	// Lo que se muestra al usuario en total en esta ventana
	render (){
		let p = this.props;

		// Vista para cuando se está cargando el "log" completo desde la base de datos
		if (this.state.loading){
			return(
				<View style = {genericStyles.simple_center}>
					{this.activateLoadLog()}
					<ActivityIndicator size = "large" color = "#0000ff" />
					{/*Mensaje: "Cargando"*/}
					<Text>{p.allMessages[1]}...</Text>
				</View>
			)
		} 

		let databaseWasRead = (this.state.completeLog !== null);

		// Vista para cuando ya se cargó el log desde la base de datos
		return(
			<View style = {genericStyles.lightGray_background}>

				{databaseWasRead && // En esta parte se despliegan las entradas del log
					<View style = {genericStyles.white_background_with_ScrollView}>
						<ScrollView>
							{this.renderLog()}
						</ScrollView>

					</View>
				}

				{!databaseWasRead && // Cuando no hay conexión y no se ha cargado el log, se muestra un botón que permite intentar cargarlo nuevamente
					<View style = {{...genericStyles.simple_center, flexDirection: 'column'}}>
						{/*Mensaje: "Ocurrió un error"*/}
						<Text style = {{textAlign: 'center'}}>{p.allMessages[3]}</Text>

						<View style = {{height: 30}}/>

						<ButtonWithIcon
							raised
							icon    = {{name: 'cached'}}
							title   = {p.allMessages[4]} // Mensaje: "Volver a intentarlo"
							onPress = {() => this.setState({loading: true})}
						/>	
					</View>
				}

				{/*Vista del botón para darle Volver*/}
				<View style = {genericStyles.down_buttons}>

					<ButtonNoIcon 
						raised
						title   = {p.allMessages[2]} // Mensaje: "Volver"
						color   = {DARK_GRAY_COLOR}
						onPress = {() => {this.props.navigation.goBack()}}
					/>
				</View>
			</View>
		)
	}
}

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages: ConsultLog_Texts[state.appPreferencesReducer.language],
	}
};

export default connect(mapStateToProps)(ConsultLog)