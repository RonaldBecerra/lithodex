import React from 'react';
import { Text, Button as ButtonNoIcon, Image, View,
		TouchableHighlight, StyleSheet, Modal, ScrollView, Alert,
		TextInput, Dimensions, Picker } from 'react-native';

import { Avatar, ListItem, CheckBox, Button as ButtonWithIcon, SearchBar} from "react-native-elements";
import { TriangleColorPicker, toHsv, fromHsv} from 'react-native-color-picker'

import { connect } from 'react-redux'
import { changeStratumComponentPermission } from '../redux/actions/popUpActions'
import { LithologyPicker_Texts } from '../languages/components/LithologyPicker'

import { LITHOLOGIES_NAMES } from '../constants/lithologies'
import { CARBONATES_GRAIN_DIAMETERS, NO_CARBONATES_GRAIN_DIAMETERS } from '../constants/grains'

import * as Log      from '../genericFunctions/logFunctions'
import * as Database from '../genericFunctions/databaseFunctions'
import * as auxiliarFunctions from '../genericFunctions/otherFunctions'
import { genericStyles, DARK_GRAY_COLOR, WHITE_COLOR } from '../constants/genericStyles'
import * as D from '../constants/Dimensions'


class LithologyPicker extends React.Component {

	constructor(props){
		super(props)
		this.deleteLithology = this.deleteLithology.bind(this);

		this.state = {
			componentKey: this.props.stratum_key + '_lithology', // Para que se sepa qué parte del estrato se va a salvar

			// Determina si los botones pueden ejecutar sus respectivas funciones, lo cual impide que se presione el mismo botón 
			// por accidente dos veces seguidas, o dos botones contradictorios
			buttonsEnabled: true,

			/******** Variables del modal 1, que es el más externo, que se abre por defecto cuando el usuario presiona desde la ventana
			   externa para seleccionar la litología */
			modal_1_visible: false,

			//******* Variables del modal 2, que es en donde se despliega la lista de litologías que el usuario puede seleccionar */
			modal_2_visible: false,
			filter_name:     "", // Almacenará el nombre que ingrese el usuario para filtrar la búsqueda de litologías

			savedLithology: this.props.data.savedLithology, // Litología ya almacenada en la base de datos
			provLithology:  this.props.data.savedLithology, // Litología seleccionada por el usuario, pero que todavía no ha sido almacenada en la base de datos

			//******* Variables del modal 3, que es en donde el usuario selecciona el color de la litología */
			modal_3_visible: false,

			// Valores ya almacenados en la base de datos
			savedHexadecimalColor: (this.props.data.savedHexadecimalColor), // Color de la litología en formato hexadecimal (cadena de caracteres)
			savedC:  (this.props.data.savedC == null) ? [null,null] : this.props.data.savedC,
			savedM:  (this.props.data.savedM == null) ? [null,null] : this.props.data.savedM,
			savedY:  (this.props.data.savedY == null) ? [null,null] : this.props.data.savedY,
			savedK:  (this.props.data.savedK == null) ? [null,null] : this.props.data.savedK,

			// Valores que el usuario selecciona o ingresa, pero que no se salvarán hasta que le dé al botón de "Aceptar"
			provHexadecimalColor:  this.props.data.savedHexadecimalColor, // Color de la litología en formato hexadecimal (cadena de caracteres)
			provC:  (this.props.data.savedC == null) ? [null,null] : this.props.data.savedC,
			provM:  (this.props.data.savedM == null) ? [null,null] : this.props.data.savedM,
			provY:  (this.props.data.savedY == null) ? [null,null] : this.props.data.savedY,
			provK:  (this.props.data.savedK == null) ? [null,null] : this.props.data.savedK,

			// Esta variable sirve para registrar cuándo fue la última vez que se pulsó sobre el triángulo de selección de color.
			// Es necesaria porque a veces al pulsar sobre él, se detecta como si se hubiesen hecho dos pulsaciones seguidas, y por eso no permitimos
			// que se lleve a cabo ninguna acción al volver a pulsar sobre él hasta que haya transcurrido cierto tiempo
			lastTimeTriangleWasSelected: 0,

			//******* Variables del modal 4, que es en donde el usuario selecciona el diámetro del grano */
			modal_4_visible:    false,
			savedGrainDiameter: this.props.data.savedGrainDiameter, // Diámetro del grano, ya almacenado en la base de datos	
			provGrainDiameter:  this.props.data.savedGrainDiameter, /* Diámetro del grano, pero que no será salvado en la base de datos hasta que el usuario
			                                                           le dé al botón de "Aceptar" */ 
			savedIsCarbonate:   this.props.data.savedIsCarbonate,   // Determina si este estrato es un carbonato, importante porque ello determina el tipo de diámetro del grano
			provIsCarbonate:    this.props.data.savedIsCarbonate,   // Igual que savedIsCarbonate, pero el valor que todavía no ha sido salvado en la base de datos.
		}
	}

	// Procedimientos que deben hacerse cuando se monta este componente
	componentDidMount(){
		/* Si no colocáramos esto, si el programador refresca esta página estando dentro de ella en la aplicación, se regresará a la 
		   ventana externa sin haber vuelto a habilitar el permiso de poder ingresar a los componentes. Antes lo habilitábamos una sola vez
		   en la ventana externa, pero ahora en todos los componentes */
		this.props.dispatchEnteringPermission(true);

		let s = this.state;
		// Aquí llamamos al procedimiento "hexToCMYK" para que los valores de C,M,Y y K se sincronicen con el valor hexadecimal del color
		// Además, si no hay diámetro del grano al iniciar, suponemos que es el más pequeño
		var color       = s.savedHexadecimalColor;
		var diameter    = s.savedGrainDiameter;
		var isCarbonate = s.savedIsCarbonate;

		if (color == null){
			color = "afd45f"; // Color aleatorio que se deja por defecto
			this.hexToCMYK(color, true);
		}	

		if (diameter == null){
			diameter = 0;
			isCarbonate = false;
		}

		this.setState({
			provHexadecimalColor:  color, 
			savedHexadecimalColor: color, 
			savedGrainDiameter:    diameter,
			provGrainDiameter:     diameter,
			savedIsCarbonate:      isCarbonate,
			provIsCarbonate:       isCarbonate,
		});	
	}

	// Procedimiento para salvar los cambios realizados en la base de datos del usuario
	async saveInDatabase(payload){
		await Database.saveStratumModule(this.props.user_id, this.props.Object_id, this.props.index, this.state.componentKey, payload, this.props.isCore, this.props.localDB);
	}

	// Procedimiento para mostrar la alerta de que no se salvaron los cambios al presionar un botón de Cancelar
	showCancelAlert(){
		// Alerta: "No se salvaron los cambios"
		Alert.alert(p.allMessages[25], p.allMessages[0]);
	}

	//******************* Métodos para el modal 1, que es el principal, el que permite ir a los otros tres **********************/

	// Activa el modal 
	showModal_1 = () => {
		let p = this.props;
		if (this.props.enteringEnabled){
			p.dispatchEnteringPermission(false);
			this.setState({modal_1_visible: true})

			Log.log_action({entry_code: ((p.data.savedC != null) ? 17 : 16), user_id: p.user_id, isCore: p.isCore, object_id: p.Object_id, stratum_key: p.stratum_key});

		}
	}

	// Oculta el modal
	hideModal_1 = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});
			this.props.dispatchEnteringPermission(true);
			this.setState({modal_1_visible: false}, () => this.setState({buttonsEnabled: true}));
		}
	}

	//******************* Métodos para el modal 2, que es en el que se despliega la lista de litologías a seleccionar **********************/

	// Activa el modal 
	showModal_2 = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {
				this.setState({modal_2_visible: true}, () => this.setState({buttonsEnabled: true}));
			})	
		}	
	}

	// Oculta el modal
	hideModal_2 = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {
				this.setState({modal_2_visible: false, filter_name: ""}, () => this.setState({buttonsEnabled: true}));
			})	
		}	
	}

	// Cada botón que representa una litología a seleccionar 
	touchableLithologyToPick(item,i){
		return(
			<ListItem
				title      = {item.name}
				key        = {i}
				leftAvatar = {<Avatar  size="medium"  source={item.uri}/>}	
				onPress = {() =>{this.lithologySelection(item)}}		
			/>
		)
	}

	// Una vez que se cambia el texto en el que se filtran las litologías, se invoca este procedimiento
	setFilter = (text) => {
		this.setState({filter_name: text})
	}

	// Función para mostrar los patrones litológicos como botones
	renderLithologies(filter_name){
		let p = this.props;
		return (
			p.sortedLithologies.filter(item => auxiliarFunctions.stringIncludesSubstring_NoStrict(item.name,filter_name))
				.map((item, i) => (
					this.touchableLithologyToPick(item,i)
				))
		)
	}

	// Usado cuando el usuario presiona sobre un TouchableHighlight para seleccionar una litología
	lithologySelection (item) {
		const newElement = {
			key: item.key,
			uri: item.uri,
		}
		this.setState({provLithology: newElement})	
	}

	// Usado para eliminar la litología que había sido seleccionada
	deleteLithology (){
		this.setState({provLithology: null});
	}

	// Se activa cuando el usuario presiona el botón "Cancelar", estando en la selección de litologías
	cancelLithologySelection = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});
			let s = this.state;
			let p = this.props;
			if (s.provLithology != s.savedLithology){
				this.showCancelAlert();	
				this.setState({provLithology: s.savedLithology});
			}
			this.setState({buttonsEnabled: true}, () => this.hideModal_2());
		}
	}

	// Se activa cuando el usuario le da al botón de "Aceptar", estando en la selección de litologías
	acceptLithologySelection = async() => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});
			
			let p = this.props;
			let s = this.state;

			let {savedHexadecimalColor, savedC, savedM, savedY, savedK, savedGrainDiameter, savedIsCarbonate} = this.state;

			const payload = {
				savedLithology: s.provLithology,
				savedHexadecimalColor, savedC, savedM, savedY, savedK, savedGrainDiameter, savedIsCarbonate,
			}

			await this.saveInDatabase(payload);
			this.setState({savedLithology: s.provLithology, buttonsEnabled: true}, () => this.hideModal_2());
		}
	}

	//******************* Métodos para el modal 3, que es en el que se selecciona el color **********************/

	// Activa u oculta el modal
	setModal_3_Visible = (isVisible) => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {
				this.setState({modal_3_visible: isVisible}, () => this.setState({buttonsEnabled: true}));
			})	
		}	
	}

	// Se activa cuando el usuario cambia el valor hexadecimal del color
	onChangeHexadecimalColor(text){
		let s = this.state;
		let p = this.props;

		if (auxiliarFunctions.onlyLettersAndNumbers(text)){
			if (text.length == 6) {
				this.setState({provHexadecimalColor: text});
				this.hexToCMYK(text);				
			}
			else {
				this.setState({provHexadecimalColor: text, provC: [null,""], provM: [null,""], provY: [null,""], provK: [null,""]});
			}
		}
		else {
			this.setState({provHexadecimalColor: null, provC: [null,""], provM: [null,""], provY: [null,""], provK: [null,""]});
			if ( (text == '') || (text == ' ') ) {}
			else {
				// Alerta: "El hexadecimal ingresado no es válido"
				Alert.alert(p.allMessages[25], p.allMessages[1]);
			}
		}
	}

	// Se activa cuando el usuario selecciona un color del triángulo de selección de color
	onColorChangeByTriangle = async(newColor) => {
		let s = this.state;
		const currentTime = new Date().getTime();
		const dif = currentTime - s.lastTimeTriangleWasSelected;

		if (dif > 2000){
			this.setState({lastTimeTriangleWasSelected: currentTime})
			var v = await fromHsv(newColor);
			v = (v.charAt(0) == "#") ? v.substring(1,7) : v;
			this.setState({provHexadecimalColor: v});
			this.hexToCMYK(v);
		}
	}

	// Para hacer que cuando el usuario edite uno de los campos CMKY, si algún otro era nulo, ese nulo se haga automáticamente cero.
	fix_null_CMYK_codes(colorNotToChange){
		let s = this.state;

		if ((colorNotToChange !== 'provC') && (s.provC[1] == "")){
			this.setState({provC: [0, "0.0000"]});
		}
		if ((colorNotToChange !== 'provM') && (s.provM[1] == "")){
			this.setState({provM: [0, "0.0000"]});
		}
		if ((colorNotToChange !== 'provY') && (s.provY[1] == "")){
			this.setState({provY: [0, "0.0000"]});
		}
		if ((colorNotToChange !== 'provK') && (s.provK[1] == "")){
			this.setState({provK: [0, "0.0000"]});
		}
	}

	// Se activa cuando el usuario cambia manualmente el valor de C, de M, de Y o de K
	on_CMYK_valueChange = async(variableName, text) => {
		let p = this.props;
		await this.fix_null_CMYK_codes(variableName);

		let {provC, provM, provY, provK} = this.state;
		let object = {provC, provM, provY, provK};

		if (auxiliarFunctions.isValidPositiveDecimalNumber(text)){
			var value = parseFloat(text);

			// Caso en que el porcentaje ingresado es correcto
			if ((0.00 <= value) && (value < 100)) {
				object[variableName][0] = value;
				this.cmykToHex(object, variableName, [value,text]);
			} 
			else { // Caso en que se ingresó un porcentaje incorrecto

				// Alerta: "El número debe ser no negativo y menor que 100"
				Alert.alert(p.allMessages[25], p.allMessages[2]);
			}
		} else {
			object[variableName][0] = 0;
			this.cmykToHex(object);

			if ((text == "") || (text == " ")){
				let object2 = {};
				object2[variableName] = [0, ""];
				this.setState(object2);
			}
			else {
				// Alerta: "El valor ingresado no es válido"
				Alert.alert(p.allMessages[25], p.allMessages[3]);
			}
		}
	}

	// Función para convertir un hexadecimal que representa un color, en formato CMYK.
	// El valor "hex" que recibe es una cadena de caracteres.
	// Consultada en: "http://www.javascripter.net/faq/hex2cmyk.htm"
	hexToCMYK(hex, storeInSaved = false){
		let computedC, computedM, computedY, computedK;
		computedC = computedM = computedY = computedK = 0;

		var r = parseInt(hex.substring(0,2),16); 
		var g = parseInt(hex.substring(2,4),16); 
		var b = parseInt(hex.substring(4,6),16); 

		// BLACK
		if (r==0 && g==0 && b==0) {
			if (storeInSaved){
				this.setState({provC: [0, "0.0000"], provM: [0, "0.0000"], provY: [0, "0.0000"], provK: [1,"1"],
								savedC: [0, "0.0000"], savedM: [0, "0.0000"], savedY: [0, "0.0000"], savedK: [1,"1"]
				})
			}
			else {
				this.setState({provC: [0, "0.0000"], provM: [0, "0.0000"], provY: [0, "0.0000"], provK: [1,"1"]})
			}
		}
		else {
			computedC = 1 - (r/255);
			computedM = 1 - (g/255);
			computedY = 1 - (b/255);

			var minCMY = Math.min(computedC,Math.min(computedM,computedY));
			var invariant = 1 - minCMY;

			computedC = ((computedC - minCMY) / invariant) * 100;
			computedM = ((computedM - minCMY) / invariant) * 100;
			computedY = ((computedY - minCMY) / invariant) * 100;
			computedK = minCMY * 100;

			// Valores en cadenas de caracteres
			const strC = (computedC == 0) ? "0.0000" : computedC.toString().slice(0,6);
			const strM = (computedM == 0) ? "0.0000" : computedM.toString().slice(0,6);
			const strY = (computedY == 0) ? "0.0000" : computedY.toString().slice(0,6);
			const strK = (computedK == 0) ? "0.0000" : computedK.toString().slice(0,6);

			// Valores numéricos
			const C = parseFloat(strC);
			const M = parseFloat(strM);
			const Y = parseFloat(strY);
			const K = parseFloat(strK);

			if (isNaN(C) || isNaN(M) || isNaN(Y) || isNaN(K)){
				// Alerta: "El hexadecimal ingresado no corresponde con ningún color"
				Alert.alert(this.props.allMessages[25], this.props.allMessages[24]);

				if (storeInSaved){
					this.setState({provC: [0, "0.0000"], provM: [0, "0.0000"], provY: [0, "0.0000"], provK: [0, "0.0000"], provHexadecimalColor: "ffffff",
								   savedC: [0, "0.0000"], savedM: [0, "0.0000"], savedY: [0, "0.0000"], savedK: [0, "0.0000"]
					});
				}
				else {
					this.setState({provC: [0, "0.0000"], provM: [0, "0.0000"], provY: [0, "0.0000"], provK: [0, "0.0000"], provHexadecimalColor: "ffffff"});
				}
				
			}
			else {
				if (storeInSaved){
					this.setState({provC: [C,strC], provM: [M,strM], provY: [Y,strY], provK: [K,strK],
								   savedC: [C,strC], savedM: [M,strM], savedY: [Y,strY], savedK: [K,strK],
					});
				}
				else {
					this.setState({provC: [C,strC], provM: [M,strM], provY: [Y,strY], provK: [K,strK]});
				}
			}		
		}
	}

	// Función para convertir un número en formato CMYK en hexadecimal
	// Es básicamente aplicar los pasos inversos de la anterior
	cmykToHex(valuesObject, variableName=null, arrayToAssign=null){
		let p = this.props;

		var computedC = valuesObject.provC[0] / 100;
		var computedM = valuesObject.provM[0] / 100;
		var computedY = valuesObject.provY[0] / 100;
		var computedK = valuesObject.provK[0] / 100;

		var invariant = parseFloat(1 - computedK).toFixed(6);

		const prov1 = parseFloat((computedC * invariant).toString().slice(0,6));
		const prov2 = parseFloat((computedM * invariant).toString().slice(0,6));
		const prov3 = parseFloat((computedY * invariant).toString().slice(0,6));
		
		computedK = parseFloat(computedK);
		computedC = parseFloat((prov1 + computedK).toString().slice(0,6));	  
		computedM = parseFloat((prov2 + computedK).toString().slice(0,6));
		computedY = parseFloat((prov3 + computedK).toString().slice(0,6));

		var b = parseInt((1 - computedY) * 255);
		var g = parseInt((1 - computedM) * 255);
		var r = parseInt((1 - computedC) * 255);

		if (!(isNaN(b)) && !(isNaN(g)) && !(isNaN(r))) {

			r = r.toString(16);
			g = g.toString(16);
			b = b.toString(16);
			var hex = r+g+b;

			this.setState({provHexadecimalColor: hex});
			
			if (variableName != null){
				let object = {};
				object[variableName] = arrayToAssign;
				this.setState(object);
			}

		} else {
			// Alerta: "No es posible convertir este código a hexadecimal"
			Alert.alert(p.allMessages[25], p.allMessages[4]);
		}
	}

	// Se activa cuando el usuario presiona el botón "Cancelar", estando en la selección de color
	cancelColorSelection = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});

			let s = this.state;
			let p = this.props;
			if (s.provHexadecimalColor != s.savedHexadecimalColor){
				this.showCancelAlert();
			}

			this.setState({
				provHexadecimalColor: s.savedHexadecimalColor,
				provC:                s.savedC,
				provM:                s.savedM,
				provY:                s.savedY,
				provK:                s.savedK,
				buttonsEnabled:       true,
			}, () => this.setModal_3_Visible(false));
		}
	}

	// Se activa cuando el usuario le da al botón de "Aceptar", estando en la selección de color
	acceptColorSelection = async() => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});

			let p = this.props;
			let s = this.state;

			if ((s.provHexadecimalColor != null) && (s.provHexadecimalColor.length == 6) 
				&& (!isNaN(s.provC[0])) && (!isNaN(s.provM[0])) && (!isNaN(s.provY[0])) && (!isNaN(s.provK[0]))){

				const payload = {
					savedLithology:        s.savedLithology,
					savedHexadecimalColor: s.provHexadecimalColor,
					savedC:                s.provC,
					savedM:                s.provM,
					savedY:                s.provY,
					savedK:                s.provK,
					savedGrainDiameter:    s.savedGrainDiameter,
					savedIsCarbonate:      s.savedIsCarbonate,
				}
				await this.saveInDatabase(payload);

				this.setState({...payload, buttonsEnabled: true}, () => this.setModal_3_Visible(false));
			}
			else {
				// Alerta: "No se puede salvar por valor inválido para el color"
				Alert.alert(p.allMessages[25], p.allMessages[5]);
				this.setState({buttonsEnabled: true});
			}
		}
	}

	//******************* Métodos para el modal 4, que es en el que se selecciona el diámetro del grano **********************/

	// Activa u oculta el modal
	setModal_4_Visible = (isVisible) => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {
				this.setState({modal_4_visible: isVisible}, () => this.setState({buttonsEnabled: true}));
			})	
		}	
	}

	// Caso en que cambiamos si el estrato es un carbonato o no
	changeIsCarbonate = () => {
		let s = this.state;
		this.setState({
			provIsCarbonate:   !s.provIsCarbonate,
			provGrainDiameter: 0,  // El diámetro del grano lo restauramos a cero
		});
	}

	cancelGrainDiameterSelection = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});

			let s = this.state;
			let p = this.props;
			if ((s.provGrainDiameter != s.savedGrainDiameter) || (s.provIsCarbonate != s.savedIsCarbonate)){
				this.showCancelAlert();
			}

			this.setState({
				provGrainDiameter: s.savedGrainDiameter,
				provIsCarbonate:   s.savedIsCarbonate,
				buttonsEnabled:    true,
			}, () => this.setModal_4_Visible(false));
		}
	}

	acceptGrainDiameterSelection = async() => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});

			let p = this.props;
			let s = this.state;

			const payload = {
				savedLithology:        s.savedLithology,
				savedHexadecimalColor: s.provHexadecimalColor,
				savedC:                s.provC,
				savedM:                s.provM,
				savedY:                s.provY,
				savedK:                s.provK,
				savedGrainDiameter:    s.provGrainDiameter,
				savedIsCarbonate:      s.provIsCarbonate,
			}
			await this.saveInDatabase(payload);

			this.setState({
				savedIsCarbonate:   s.provIsCarbonate,
				savedGrainDiameter: s.provGrainDiameter,
				buttonsEnabled:     true,
			}, () => this.setModal_4_Visible(false));
		}
	}

	// ************************************** Distintas vistas para el usuario **********************************************

	// Esto es lo que se muestra cuando el usuario entra en la ventana para litología desde la vista externa (ObjectScreen)
	Modal_1_View(){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {true}
					visible        = {this.state.modal_1_visible}
					onRequestClose = {() => this.hideModal_1()}
				>

					<View style = {genericStyles.lightGray_background}>

						{/*Cabecera de la pantalla que dice el nombre del estrato que se está modificando*/}
						<View style = {genericStyles.modalHeader}>
							{/* Mensaje: "Litología del estrato"*/}
							<Text style = {{justifyContent: 'center', alignItems: 'center', fontSize: 17, fontWeight: 'bold'}}>
								{p.allMessages[6]}: {p.stratumName}
							</Text>
						</View>

						{/*Botones para ir a las otras vistas*/}
						<View style = {genericStyles.white_background_with_ScrollView}>

							<ScrollView>

								<View style = {{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 23}}> 
									<ButtonWithIcon // Botón para cambiar la litología
										raised
										title   = {p.allMessages[7]} // Mensaje: "Litología"
										onPress = {() => {this.showModal_2()}}
										icon    = {{name: 'playlist-add'}}
									/>
								</View>

								<View style = {{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 23}}> 
									<ButtonWithIcon /// Botón para cambiar el color de la litología
										raised
										title   = {p.allMessages[8]} // Mensaje: "Color"
										onPress = {() => {this.setModal_3_Visible(true)}}
										icon    = {{name: 'color-lens'}}
									/>
								</View>

								<View style = {{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 23}}>
									<ButtonWithIcon /// Botón para cambiar el diámetro del grano
										raised
										title   = {p.allMessages[9]} // Mensaje: "Diámetro del grano"
										onPress = {() => {this.setModal_4_Visible(true)}}
										icon    = {{name: 'fiber-manual-record'}}
									/>
								</View>

								<View style = {{flex: 1, alignItems: 'center', justifyContent: 'center', padding: 23}}>
									<ButtonNoIcon /// Botón para cerrar esta vista
										raised
										title   = {p.allMessages[10]} // Mensaje: "Volver"
										color   = {DARK_GRAY_COLOR}
										onPress = {this.hideModal_1}
									/>
								</View>

							</ScrollView>
						</View>

						{/*//Parte en la que se muestran los componentes ya salvados*/}
						<View style = {{flex: 0.15, flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center', padding: 10}}>

							{/*Mensaje: "Litología"*/}
							<Text style = {{textAlign: 'center', justifyContent: 'center', alignItems: 'center', color: 'blue'}}>* {p.allMessages[7]}: 
								<Text style = {{color: 'black'}}> {(s.savedLithology == null) ? null : p.allLithologyNames.find(element => element.key === s.savedLithology.key).name}</Text>
							</Text>

							{/*Mensaje: "Color"*/}
							<Text style = {{textAlign: 'center', justifyContent: 'center', alignItems: 'center', color: 'blue'}}>* {p.allMessages[8]}: 
								<Text style = {{color: 'black'}}> {(s.savedHexadecimalColor == null) ? null : s.savedHexadecimalColor}</Text>	
							</Text>

							{/*Mensaje: "Diámetro del grano"*/}
							<Text style = {{textAlign: 'center', justifyContent: 'center', alignItems: 'center', color: 'blue'}}>* {p.allMessages[9]}: 
								<Text style = {{color: 'black'}}> {(s.savedIsCarbonate) ? p.allCarbonateGrainDiameterNames[s.savedGrainDiameter]: p.allNoCarbonateGrainDiameterNames[s.savedGrainDiameter]}</Text>	
							</Text>

						</View>

					</View>
				</Modal>
			</View>
		)
	}

	// Esto es lo que se muestra cuando el usuario entra en la ventana para seleccionar la litología 
	Modal_2_View(){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {true}
					visible        = {this.state.modal_2_visible}
					onRequestClose = {() => this.hideModal_2()}
				>
					<View style = {genericStyles.lightGray_background}>

						{/*Primer sector que incluye el filtro de búsqueda y la lista desplegada de litologías*/}
						<View style = {genericStyles.white_background_without_ScrollView}>

							{/*Aquí el usuario puede filtrar la búsqueda de la litología*/}
							<SearchBar
								value                 = {s.filter_name}
								selectTextOnFocus     = {true}
								lightTheme            = {true}
								textAlign             = {'center'} 
								inputStyle            = {{color: 'black', backgroundColor: '#ffffff'}}
								placeholder           = {p.allMessages[11]} // Mensaje: "Buscar..."
								placeholderTextColor  = {'gray'}
								onChangeText          = {text => this.setFilter(text)}
							/>

							{/*En esta parte deben mostrarse las litologías*/}
							<View style = {localStyles.lithologyPicker}>
								<ScrollView>
									{this.renderLithologies(s.filter_name)}
								</ScrollView>
							</View>

						</View>

						{/*//Parte en la que se muestra el nombre de la litología seleccionada, lista para agregarla*/}
						<View style = {localStyles.smallColumn}>

							<View style = {{flex: 0.6}}>
								{/*Mensaje: "Litología seleccionada"*/}
								<Text style = {{textAlign: 'center', flex: 0.7, justifyContent: 'center', alignItems: 'center', color: 'blue'}}>{p.allMessages[12]}:{"\n"}	
									<Text style = {{color: 'black'}}>{(s.provLithology == null) ? null : 
										p.allLithologyNames.find(element => element.key === s.provLithology.key).name}
									</Text>	
								</Text>
							</View>

							<View style = {{flex: 0.4}}>
								<ButtonNoIcon 
									raised
									title   = {p.allMessages[13]} /// Mensaje: "Eliminar"
									color   = 'red'
									onPress = {this.deleteLithology}
								/>
							</View>

						</View>

						{/*//Segundo sector, que es la vista de los botones para darle Aceptar o Cancelar*/}
						<View style = {genericStyles.down_buttons}>

							<View style = {{paddingRight: 25}}>
								<ButtonNoIcon
									raised
									color   = {DARK_GRAY_COLOR}
									title   = {p.allMessages[14]} // Mensaje: "Cancelar"
									onPress = {() => this.cancelLithologySelection()}
								/>
							</View>

							<View style = {{paddingLeft: 25}}>
								<ButtonWithIcon
									raised
									title   = {p.allMessages[15]} // Mensaje: "Aceptar"
									icon    = {{name: 'check'}}
									onPress = {() => this.acceptLithologySelection()}
								/>
							</View>

						</View>
					</View>
				</Modal>
			</View>
		)
	}

	// Esta función es utilizada varias veces por Modal_3_View para mostrar y solicitarle al usuario los valores de C, M, Y y K del color
	CMYK_Input_View(variable, variableRealName, variableNameForUser){
		return(
			<View style = {{flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
				<TextInput 
					value             = {variable[1]}
					selectTextOnFocus = {true}
					textAlign         = {'center'}    
					style             = {localStyles.colorValueInput}
					maxLength         = {6}
					onChangeText      = {text => this.on_CMYK_valueChange(variableRealName, text)}
					keyboardType      = 'phone-pad'
				/>
				<Text style = {{flex: 0.5, paddingTop: 3, fontWeight: 'bold'}}>{variableNameForUser}</Text>
			</View>
		)
	}

	// Esto es lo que se muestra cuando el usuario entra en la ventana para seleccionar el color
	Modal_3_View(){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {true}
					visible        = {this.state.modal_3_visible}
					onRequestClose = {() => this.setModal_3_Visible(false)}
				>
					<View style = {genericStyles.lightGray_background}>

						{/*Primer sector que incluye todos los campos referentes al color*/}
						<View style = {{...genericStyles.white_background_with_ScrollView, flex: 0.44}}>
							<ScrollView>

								{/*Mensaje: "Valor hexadecimal*/}
								<Text style = {genericStyles.subtitle}>{p.allMessages[16]}</Text>

								<View style = {{flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}> 

									{/*//Esto es sólo para ajustar el espacio*/}
									<View style = {{flex: 0.4}}/>

									<TextInput 
										defaultValue      = {s.provHexadecimalColor}
										selectTextOnFocus = {true}
										textAlign         = {'center'} 
										autoCapitalize    = "none"
										style             = {localStyles.colorValueInput}
										maxLength         = {6} 
										onChangeText      = {text => this.onChangeHexadecimalColor(text)}
									/>

									{/*//Esto es sólo para ajustar el espacio*/}
									<View style = {{flex: 0.4}}/>
								</View>

								{/*//Mensaje: "Código CMYK{"\n"}Se indican porcentajes"*/}
								<Text style = {genericStyles.subtitle}>
									{p.allMessages[17]}{"\n"}{p.allMessages[18]} (%)
								</Text>

								{/*//Aquí se ingresan los valores C y M del color*/}
								<View style = {{flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 5}}>
									{this.CMYK_Input_View(s.provC, 'provC', 'C')}
									{this.CMYK_Input_View(s.provM, 'provM', 'M')}
								</View>

								{/*//Aquí se ingresan los valores Y y K del color*/}
								<View style = {{flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 5}}>
									{this.CMYK_Input_View(s.provY, 'provY', 'Y')}
									{this.CMYK_Input_View(s.provK, 'provK', 'K')}
								</View>

							</ScrollView>
						</View>

						{/*//Segundo sector que incluye el triángulo donde se selecciona el color*/}
						<View style = {{...genericStyles.white_background_without_ScrollView, flex: 0.44}}>

							{/*Mensaje: "Paleta de colores"*/}
							<Text style = {genericStyles.subtitle}>{p.allMessages[19]}</Text>

							<View style = {localStyles.colorPicker}>
								<TriangleColorPicker
									color         = {s.provHexadecimalColor}
									onColorChange = {this.onColorChangeByTriangle}
									style         = {{flex: 1}}
								/>
							</View>

						</View>

						{/*Tercer sector, que es la vista de los botones para darle Aceptar o Cancelar*/}
						<View style = {genericStyles.down_buttons}>

							<View style = {{paddingRight: 25}}>
								<ButtonNoIcon
									raised
									color   = {DARK_GRAY_COLOR}
									title   = {p.allMessages[14]} // Mensaje: "Cancelar"
									onPress = {() => this.cancelColorSelection()}
								/>
							</View>

							<View style = {{paddingLeft: 25}}>
								<ButtonWithIcon
									raised
									title   = {p.allMessages[15]} // Mensaje: "Aceptar"
									icon    = {{name: 'check'}}
									onPress = {() => this.acceptColorSelection()}
								/>
							</View>
						</View>

					</View>
				</Modal>
			</View>
		)
	}

	// Esto es lo que se muestra cuando el usuario entra en la ventana para seleccionar el diámetro del grano
	Modal_4_View(){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {true}
					visible        = {this.state.modal_4_visible}
					onRequestClose = {() => this.setModal_4_Visible(false)}
				>
					<View style = {genericStyles.lightGray_background}>

						{/*Primer sector que incluye todos los campos referentes al color*/}
						<View style = {genericStyles.white_background_with_ScrollView}>
							<ScrollView>
								<View style = {{paddingTop: 50, paddingBottom: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
									<CheckBox // Cuadro que determina si es un carbonato o no
										title   = {p.allMessages[20]} // Mensaje: "Es un carbonato"
										checked = {s.provIsCarbonate}
										onPress = {() => {this.changeIsCarbonate()}}
									/>
								</View>

								{s.provIsCarbonate && 
									<View style = {{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
										< /// Aquí el usuario selecciona el diámetro en caso de que estemos ante un carbonato
										Picker
											selectedValue = {s.provGrainDiameter}
											style         = {{height: 130, width: 200}}
											onValueChange = {(itemValue, itemIndex) => this.setState({provGrainDiameter: itemValue})}
										>
											<Picker.Item label = {"          " + p.allCarbonateGrainDiameterNames[0]} value = {0}/>
											<Picker.Item label = {"          " + p.allCarbonateGrainDiameterNames[1]} value = {1}/>
											<Picker.Item label = {"          " + p.allCarbonateGrainDiameterNames[2]} value = {2}/>
											<Picker.Item label = {"          " + p.allCarbonateGrainDiameterNames[3]} value = {3}/>
											<Picker.Item label = {"          " + p.allCarbonateGrainDiameterNames[4]} value = {4}/>
											<Picker.Item label = {"          " + p.allCarbonateGrainDiameterNames[5]} value = {5}/>
											<Picker.Item label = {"          " + p.allCarbonateGrainDiameterNames[6]} value = {6}/>

										</Picker>
									</View>
								}

								{!s.provIsCarbonate && 
									<View style = {{flexDirection: 'row', alignItems: 'center', justifyContent: 'center'}}>
										< // Aquí el usuario selecciona el diámetro en caso de que estemos ante un carbonato
										Picker
											selectedValue = {s.provGrainDiameter}
											style         = {{height: 130, width: 200}}
											onValueChange = {(itemValue, itemIndex) => this.setState({provGrainDiameter: itemValue})}
										>
											<Picker.Item label = {"          " + p.allNoCarbonateGrainDiameterNames[0]} value = {0}/>
											<Picker.Item label = {"          " + p.allNoCarbonateGrainDiameterNames[1]} value = {1}/>
											<Picker.Item label = {"          " + p.allNoCarbonateGrainDiameterNames[2]} value = {2}/>
											<Picker.Item label = {"          " + p.allNoCarbonateGrainDiameterNames[3]} value = {3}/>
											<Picker.Item label = {"          " + p.allNoCarbonateGrainDiameterNames[4]} value = {4}/>
											<Picker.Item label = {"          " + p.allNoCarbonateGrainDiameterNames[5]} value = {5}/>
											<Picker.Item label = {"          " + p.allNoCarbonateGrainDiameterNames[6]} value = {6}/>
											<Picker.Item label = {"          " + p.allNoCarbonateGrainDiameterNames[7]} value = {7}/>

										</Picker>
									</View>
								}

							</ScrollView>
						</View>


						{/*Tercer sector, que es la vista de los botones para darle Aceptar o Cancelar*/}
						<View style = {genericStyles.down_buttons}>

							<View style = {{paddingRight: 25}}>
								<ButtonNoIcon
									raised
									color   = {DARK_GRAY_COLOR}
									title   = {p.allMessages[14]} // Mensaje: "Cancelar"
									onPress = {() => this.cancelGrainDiameterSelection()}
								/>
							</View>

							<View style = {{paddingLeft: 25}}>
								<ButtonWithIcon
									raised
									title   = {p.allMessages[15]} // Mensaje: "Aceptar"
									icon    = {{name: 'check'}}
									onPress = {() => this.acceptGrainDiameterSelection()}
								/>
							</View>
						</View>

					</View>
				</Modal>
			</View>
		)
	}

	// Ventana principal
	render() {
		let s = this.state;
		let p = this.props;

		return (
			<View>

				{/*Modales*/}
				{this.Modal_1_View()} 
				{this.Modal_2_View()}
				{this.Modal_3_View()}
				{this.Modal_4_View()}

				{/*Ésta es la parte que ve el usuario cuando está en la ventana externa*/}

				{ // Caso en que no se ha seleccionado ninguna litología y se está haciendo una captura del afloramiento
				!s.savedLithology && p.takingShot &&
					<View style = {{width: D.LITHOLOGY_PICKER_WIDTH, height: p.height, borderWidth: 1, borderColor: 'black'}}/>
				}

				{ // Caso en que no se ha seleccionado ninguna litología, la altura es menor que 18 y no se está haciendo captura del afloramiento
				!s.savedLithology && (p.height < 18) && (!p.takingShot) &&
					<TouchableHighlight onPress={()=>{this.showModal_1(true)}}  style={{width: D.LITHOLOGY_PICKER_WIDTH, height: p.height}}>
						<View style = {localStyles.showInstructionsObjectScreen}/>
					</TouchableHighlight>
				}

				{ /// Caso en que no se ha seleccionado ninguna litología, la altura mayor o igual que 18 y no se está haciendo captura del afloramiento
				!s.savedLithology && (p.height >= 18) && (!p.takingShot) &&
					<TouchableHighlight onPress={()=>{this.showModal_1(true)}}  style={{width: D.LITHOLOGY_PICKER_WIDTH, height: p.height}}>
						<View style = {localStyles.showInstructionsObjectScreen}>
							{/*Mensaje: "(Toque para cambiar la litología)"*/}
							<Text>{p.allMessages[21]}</Text>
						</View>
					</TouchableHighlight>
				}

				{ /// Caso en que ya se seleccionó una litología
				s.savedLithology && 
					<TouchableHighlight onPress={()=>{this.showModal_1(true)}}  style={{width: D.LITHOLOGY_PICKER_WIDTH, height: p.height}}>
						<View style = {{ 
							flex:            1, 
							flexDirection:   'row', 
							justifyContent:  'flex-start', 
							alignItems:      'center',  
							backgroundColor: "#"+s.savedHexadecimalColor,
							width:           (s.savedIsCarbonate) ? (80 + s.savedGrainDiameter * D.LITHOLOGY_ADDING_TERM) : (50 + s.savedGrainDiameter * D.LITHOLOGY_ADDING_TERM),     
						}}>
							<Image 
								source       = {s.savedLithology.uri} 
								resizeMethod = "auto"
								style        = {{
									width:       (s.savedIsCarbonate) ? (80 + s.savedGrainDiameter * D.LITHOLOGY_ADDING_TERM) : (50 + s.savedGrainDiameter * D.LITHOLOGY_ADDING_TERM),
									height:      p.height, 
									opacity:     0.5, 
									borderColor: 'black', 
									borderWidth: 1,
								}}
							/>
						</View>
					</TouchableHighlight>
				} 
			</View>
		);
	}
}

/// Constante para darle formato a los diversos componentes de esta pantalla
const localStyles = StyleSheet.create({

	// Empleado para mostrar en la ventana "ObjectScreen" el texto que indica que se debe tocar allí para cambiar la litología
	showInstructionsObjectScreen: {
		flex:           1,
		flexDirection:  'column',
		justifyContent: 'center',
		alignItems:     'center',
		borderColor:    'black',
		borderWidth:    1,
	},

	// Formato para mostrar la lista completa de litologías a seleccionar
	lithologyPicker: {
		flex:           8,
		flexDirection:  'column',
		padding:        10
	},

	// Para darle formato al triángulo de selección de color
	colorPicker: {
		flex:          10,
		flexDirection: 'column',
		paddingTop:    1,
	},

	// Es para el formato de los TextInput, pero utilizado sólo en los campos relacionados al color de la litología
	colorValueInput: {
		height:      28,
		borderWidth: 1,
		flex:        1,
		padding:     5, // Esto es lo que hace que el texto no salga pegado al borde
		borderColor: 'black',
		width:       90,
	},

	// Usado cuando se quiere mostrar la litología seleccionada junto al botón de eliminarla
	smallColumn: {
		flex:           0.2,
		flexDirection:  'column',
		justifyContent: 'space-around',
		alignItems:     'center',
		padding:        10,
	},

});

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages:       LithologyPicker_Texts[state.appPreferencesReducer.language], 
		user_id:           state.userReducer.user_id,
		localDB:           state.userReducer.localDB,
		sortedLithologies: state.libraryReducer.sortedLithologies,
		enteringEnabled:   state.popUpReducer.stratumComponentEnabled,

		// Aquí almacenamos los nombres de las litologías que se le mostrarán al usuario
		allLithologyNames: LITHOLOGIES_NAMES[state.appPreferencesReducer.language],

		// Aquí almacenamos los nombres de los tamaños de grano para carbonatos
		allCarbonateGrainDiameterNames: CARBONATES_GRAIN_DIAMETERS[state.appPreferencesReducer.language],

		// Aquí almacenamos los nombres de los tamaños de grano para no carbonatos
		allNoCarbonateGrainDiameterNames: NO_CARBONATES_GRAIN_DIAMETERS[state.appPreferencesReducer.language],
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchEnteringPermission: (bool) => dispatch(changeStratumComponentPermission(bool)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(LithologyPicker);