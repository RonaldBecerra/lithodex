import React, { Component } from 'react';
import MapView from 'react-native-maps'

import { View, Button as ButtonNoIcon, } from 'react-native';

import { connect } from 'react-redux'
import { GoogleMaps_Texts } from '../languages/screens/GoogleMaps'
import { genericStyles, DARK_GRAY_COLOR }    from '../constants/genericStyles'

class GoogleMaps extends Component{

	constructor(props){
		super(props)
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps }) => ({
		title:           GoogleMaps_Texts[screenProps.language][0],
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		}
	});

	render(){
		let p = this.props;
		let s = this.state;
		
		return(
			<View style = {genericStyles.lightGray_background}>
				{/*En esta parte se muestra el mapa*/}
				<View style = {genericStyles.white_background_with_ScrollView}>
					<MapView
						style  = {{flex: 1}}
						region = {{
							latitude:  p.navigation.getParam('latitude')[0],
							longitude: p.navigation.getParam('longitude')[0],
							latitudeDelta:  0.0143,
							longitudeDelta: 0.0134,
						}}
						showsUserLocation
						loadingEnabled
					/>
				</View>

				{/*//Vista del botón "Volver"*/}
				<View style = {genericStyles.down_buttons}>

					<ButtonNoIcon 
						raised
						title   = {p.allMessages[1]} // Mensaje: "Volver"
						color   = {DARK_GRAY_COLOR}
						onPress = {() => {p.navigation.goBack()}}
					/>
				</View>
			</View>
		)
	}
}

/// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages: GoogleMaps_Texts[state.appPreferencesReducer.language],
		user_id:     state.userReducer.user_id,
	}
};

export default connect(mapStateToProps)(GoogleMaps);