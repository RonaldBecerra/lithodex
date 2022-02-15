import React, { Component } from 'react'
import { StyleSheet, Text, View, Image, ScrollView } from 'react-native'

import {genericStyles}  from '../constants/genericStyles'
import * as Log         from '../genericFunctions/logFunctions'
import { connect } from 'react-redux'
import { AboutLithoDex_Texts } from '../languages/screens/AboutLithoDex'


class AboutLithoDex extends Component {

	constructor(props) {
		super(props)
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps }) => ({
		title:           AboutLithoDex_Texts[screenProps.language][6],
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		}
	});

	// Para registrar en el "log" que se ha ingresado en la información de la aplicación
	componentDidMount() {
		Log.log_action({entry_code: 3, user_id: this.props.user_id});    
	}

	render (){
		let p = this.props;
		return (
			<ScrollView>
				<View style = {{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop:40}}>
					{/*Mensaje: "LithoDex v3" ---> Cambiar el v3 por la versión correspondiente*/}
		        	<Text style = {{textAlign: 'center', fontWeight: 'bold'}}>{p.allMessages[0]}</Text>

		        	{/*//Mensaje: "Desarrollado por estudiantes y profesores\nde la Universidad Simón Bolívar"*/}
		        	<Text style = {{textAlign: 'center'}}>{p.allMessages[1]}{"\n"}</Text>

		        	{/*//Mensaje: "Profesores asesores"*/}
		        	<Text style = {{textAlign: 'center', fontWeight: 'bold'}}>{p.allMessages[2]}:</Text>

		        	{/*//Mensaje: "Prof."*/}
		        	<Text style = {{textAlign: 'center'}}>{p.allMessages[3]} Mireya Morales {"\n"}{p.allMessages[3]} José Baena {"\n"}</Text>

		        	{/*//Mensaje: "Desarrolladores"*/}
		        	<Text style = {{textAlign: 'center', fontWeight: 'bold'}}>{p.allMessages[4]}:</Text>

		        	<Text style = {{textAlign: 'center'}}>v1 Gabriel Gutiérrez {"\n"}v2 Daniel Francis {"\n"}v3 Ronald Becerra {"\n"}</Text>

		       		{/*Mensaje: "Colaboradores"*/}
		        	<Text style = {{textAlign: 'center', fontWeight: 'bold'}}>{p.allMessages[5]}:</Text>

		        	{/*//Mensaje: "Prof."*/}
		        	<Text style = {{textAlign: 'center'}}>{p.allMessages[3]} Masun Nabhan Homsi {"\n"}{p.allMessages[3]} Miguel Torrealba {"\n"}{p.allMessages[3]} Marla Corniel</Text>
		        		
	      		</View>
	      	</ScrollView>
		);
	}
}

/// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages: AboutLithoDex_Texts[state.appPreferencesReducer.language],
		user_id:     state.userReducer.user_id,
	}
};

export default connect(mapStateToProps)(AboutLithoDex);