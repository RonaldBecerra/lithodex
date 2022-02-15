import React, { Component } from 'react';
import { Text, View, TextInput, Button as ButtonNoIcon, 
		ScrollView, Alert, Keyboard, ActivityIndicator} from 'react-native';

import {Button as ButtonWithIcon} from 'react-native-elements'

import { connect } from 'react-redux'
import { changeLoadView, changeStratumComponentPermission } from '../../redux/actions/popUpActions'
import { ObjectStratumForm_Texts } from '../../languages/screens/objectsOfStudy/ObjectStratumForm'

import * as Log      from '../../genericFunctions/logFunctions'
import * as Database from '../../genericFunctions/databaseFunctions'

import { genericStyles, DARK_GRAY_COLOR } from '../../constants/genericStyles'
import { OUTCROPS_DOCUMENT_ID, CORES_DOCUMENT_ID } from '../../constants/appConstants'
import * as D from '../../constants/Dimensions'
import * as auxiliarFunctions from '../../genericFunctions/otherFunctions'
import _ from "lodash"


class ObjectStratumForm extends Component {

	constructor(props) {
		super(props)
		this.keyboardDidShow = this.keyboardDidShow.bind(this)
		this.keyboardDidHide = this.keyboardDidHide.bind(this)

		// Propiedades que tenemos que inicializar para manejar esta vista, independientemente de si el estrato se está creando o actualizando
		const commonProperties = {
			...this.props.navigation.state.params, // Recuperamos la información que se le pasa a esta vista

			factor: D.SIZE_OF_UNIT / this.props.navigation.getParam('scale')[0], // Convierte una medida expresada en metros o pies en el equivalente que ocupa en la pantalla
			
			// Determina si el teclado está visible. Esto lo pusimos porque no queremos que los botones de "Aceptar" y "Cancelar" de la parte inferior cierren la vista cuando el teclado está visible
			keyboardAvailable: false,
			
			loading: true, // Variable que determina si todavía se está cargando información desde la base de datos
			loadFunctionOpened: true, // Indica si se puede ingresar a la función loadLayerList

			// Determina si los botones pueden ejecutar sus respectivas funciones, lo cual impide que se presione el mismo botón 
			// por accidente dos veces seguidas, o dos botones contradictorios
			buttonsEnabled: true,
		}

		// Caso en que estamos editando un estrato ya creado
		if (this.props.navigation.getParam('index') != null){
			this.state = {
				...commonProperties,
				// Si se modifica el espesor, de todos modos necesitamos saber su valor anterior. Por eso lo conservamos.
				previousThickness: this.props.navigation.getParam('thickness'),
				previousName:      this.props.navigation.getParam('stratumName')
			}
		} 
		else { // Caso en que estamos añadiendo un nuevo estrato
			this.state = {
				...commonProperties,
				// Información nueva
				thickness:  [[null,null],[null,null]],  // El primer elemento representará el espesor del estrato en metros, y el segundo, en pies
				stratumName: null,  // Nombre del estrato que se añadirá
			}
		}
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps }) => ({
		title:           ObjectStratumForm_Texts[screenProps.language][0],
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		}
	});

	/* Para cargar la lista de estratos. Esto se utiliza cuando vamos a editar un estrato existente, porque en ese caso, si recibiéramos dicha
	lista a través de props, no habría garantía de que se estuviese empleando la versión más actualizada */
	async loadLayerList () {
		await this.props.localDB.get((this.state.isCore ? CORES_DOCUMENT_ID : OUTCROPS_DOCUMENT_ID))
			.then(document => {
				this.setState({layerList: document.objects[this.state._id].layerList, loading: false}); 
			})
	}

	// Para registrar en el "log" que se entró en el formulario de estrato de núcleo
	componentDidMount(){
		// Aquí inicializamos los escuchas que determinan si el teclado se está mostrando o no
		this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow);
		this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide);

		Log.log_action({entry_code: (this.props.navigation.getParam('index') ? 13 : 11), user_id: this.props.user_id, isCore: this.state.isCore, object_id: this.state._id, stratum_key: this.state.key});

	}

	componentWillUnmount() {
		// Habilitamos nuevamente el poder ingresar a los otros componentes de los estratos
		this.props.dispatchEnteringPermission(true);

		// Quitamos los escuchas cuando salimos de esta ventana
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

	// Se activa cuando el usuario le da al botón de "Aceptar", y determina si hay que añadir un nuevo estrato, o se modifica uno ya existente
	acceptSettings = () => {
		let s = this.state;
		let p = this.props;

		if (s.buttonsEnabled){
			if (s.stratumName == null){
				// Alerta: "El nombre del estrato no puede ser nulo"
				Alert.alert(p.allMessages[1], p.allMessages[3]);
			}
			else if (s.thickness[0][0] == null){
				// Alerta: "El espesor no puede ser nulo"
				Alert.alert(p.allMessages[1], p.allMessages[4]);
			}
			else if (p.navigation.getParam('index') != null){
				if ((s.previousThickness[0][0] !== s.thickness[0][0]) || (s.previousName !== s.stratumName)){
					this.editLayer();
				} else {
					this.props.navigation.goBack();
				}	
			} 
			else {
				this.addLayer();
			}
		}
	}

	// Procedimiento para el caso en que el usuario le da al botón de Cancelar
	refuseSettings = () => {
		if (this.props.navigation.getParam('index') != null){
			// Alerta: "No se salvaron los cambios"
			Alert.alert(this.props.allMessages[1], this.props.allMessages[2]);			
		}
		this.props.navigation.goBack();
	}

	// Añadir un nuevo estrato
	addLayer = () => {
		this.setState({buttonsEnabled: false},
			async() => {
				const numberOfLayers = this.state.layerList.length;
				const thickness      = this.state.thickness;
				const baseHeight     = this.state.baseHeight;
				const factor         = this.state.factor;

				// Primero decidimos qué alturas va a tener este estrato
				if (this.state.isCore){
					if (numberOfLayers == 0){
						var upperLimitMeters = baseHeight[0];
						var upperLimitFeet   = baseHeight[1];
					} else {
						var previousElement  = this.state.layerList[numberOfLayers-1];
						var upperLimitMeters = previousElement.lowerLimit[0];
						var upperLimitFeet   = previousElement.lowerLimit[1];
					} 

					var lowerLimitMeters = auxiliarFunctions.repairNumber(upperLimitMeters[0] - thickness[0][0], 15);
					var lowerLimitFeet   = auxiliarFunctions.repairNumber(upperLimitFeet[0]   - thickness[1][0], 15);
				}
				else {
					if (numberOfLayers == 0){
						var lowerLimitMeters = baseHeight[0];
						var lowerLimitFeet   = baseHeight[1];
					} else {
						var previousElement  = this.state.layerList[0];
						var lowerLimitMeters = previousElement.upperLimit[0];
						var lowerLimitFeet   = previousElement.upperLimit[1];
					} 

					var upperLimitMeters = auxiliarFunctions.repairNumber(lowerLimitMeters[0] + thickness[0][0], 15);
					var upperLimitFeet   = auxiliarFunctions.repairNumber(lowerLimitFeet[0]   + thickness[1][0], 15);
				}

				var shownHeight = [factor * thickness[0][0], factor * thickness[1][0]];
				const key = auxiliarFunctions.generate_key(); // Generamos un identificador del estrato

				// Estructura del estrato que añadiremos
				const objectToAdd = {
					shownHeight, // Altura con la que se muestra el estrato en la pantalla
					thickness,   // Espesor real del estrato.

					// Guardar los límites de altura
					lowerLimit: [lowerLimitMeters, lowerLimitFeet], // Altura a la que comienza el estrato
					upperLimit: [upperLimitMeters, upperLimitFeet], // Altura a la que termina el estrato

					key,
					name: this.state.stratumName, // Nombre del estrato

					// Campos principales del estrato, que se inician como son vacíos
					lithology_data: {},
					structure_data: {},
					fossil_data:    {},
					image_data:     {},
					note_data:      {},
				}

				if (this.state.isCore){
					await this.state.layerList.push(objectToAdd);
				}
				else {
					await this.state.layerList.unshift(objectToAdd);
				}

				try{
					// Los argumentos son: 1) user_id, 2) object_id, 3) layerList, 4) isCore, 5) localDB, 6) stratum_key, 7) kind = 0
					await Database.saveLayerList(this.props.user_id, this.state._id, this.state.layerList, this.state.isCore, this.props.localDB, key, 0);
					this.props.dispatchChangeLoadView(true);
					this.props.navigation.goBack();
				}
				catch(error){
					console.error(error.toString());
					this.setState({buttonsEnabled: true});
				}
			}
		)
	}

	// Modificar un estrato ya existente
	editLayer = () => {
		this.setState({buttonsEnabled: false},
			async() => {
				let s = this.state;

				var currentLayer  = s.layerList[s.index];
				currentLayer.name = s.stratumName;

				if (s.previousThickness[0][0] != s.thickness[0][0]){
					let elem;
					currentLayer.thickness = s.thickness;
					currentLayer.shownHeight = [s.factor * s.thickness[0][0], s.factor * s.thickness[1][0]];

					// La actualización necesaria es distinta para núcleos que para afloramientos
					if (s.isCore){
						// Actualizar el límite inferior del estrato actual
						currentLayer.lowerLimit[0] = auxiliarFunctions.repairNumber(currentLayer.upperLimit[0][0] - s.thickness[0][0], 15);
						currentLayer.lowerLimit[1] = auxiliarFunctions.repairNumber(currentLayer.upperLimit[1][0] - s.thickness[1][0], 15);

						// Actualizar los límites de los estratos inferiores al actual (que tienen un índice más alto)
						for (i = s.index + 1; i < s.layerList.length; i++){
							elem = s.layerList[i];
							elem.upperLimit    = _.cloneDeep(s.layerList[i-1].lowerLimit);
							elem.lowerLimit[0] = auxiliarFunctions.repairNumber(elem.upperLimit[0][0] - elem.thickness[0][0], 15);
							elem.lowerLimit[1] = auxiliarFunctions.repairNumber(elem.upperLimit[1][0] - elem.thickness[1][0], 15);
						}
					} else {
						// Actualizar el límite superior del estrato actual
						currentLayer.upperLimit[0] = auxiliarFunctions.repairNumber(currentLayer.lowerLimit[0][0] + s.thickness[0][0], 15);
						currentLayer.upperLimit[1] = auxiliarFunctions.repairNumber(currentLayer.lowerLimit[1][0] + s.thickness[1][0], 15);

						// Actualizar los límites de los estratos superiores al actual (que tienen un índice más bajo)
						for (i = this.state.index - 1; i >= 0; i--){
							elem = s.layerList[i];
							elem.lowerLimit    = _.cloneDeep(s.layerList[i+1].upperLimit);
							elem.upperLimit[0] = auxiliarFunctions.repairNumber(elem.lowerLimit[0][0] + elem.thickness[0][0], 15);
							elem.upperLimit[1] = auxiliarFunctions.repairNumber(elem.lowerLimit[1][0] + elem.thickness[1][0], 15);
						}
					}
				}

				try{
					// Los argumentos son: 1) user_id, 2) object_id, 3) layerList, 4) isCore, 5) localDB, 6) stratum_key, 7) kind = 1
					await Database.saveLayerList(this.props.user_id, s._id, s.layerList, s.isCore, this.props.localDB, s.key, 1);
					this.props.dispatchChangeLoadView(true);
					this.props.navigation.goBack();
				}
				catch(error){
					console.error(error.toString());
					this.setState({buttonsEnabled: true});
				}
			}
		)
	}

	// Procedimiento para cambiarle el nombre al nuevo estrato
	onChangeName = (text) => {
		if ((text == " ") || (text == "")){
			this.setState({stratumName: null});  
		}
		else {
			this.setState({stratumName: text}); 
		}   
	}

	// Procedimiento para actualizar el espesor real del estrato -> "thickness"
	onChangeThickness = async(text, unit) => {
		if (auxiliarFunctions.isValidPositiveDecimalNumber(text)){
			if (unit == 0){ // Caso en que el valor provisto fue el de metros
				this.setState({
					thickness: [[parseFloat(text),text], auxiliarFunctions.metersToFeet(text)]
				});
			}
			else { // Caso en que el valor provisto fue el de pies
				this.setState({
					thickness: [auxiliarFunctions.feetToMeters(text), [parseFloat(text),text]],
				});				
			}
		} else {
			if ((text == " ") || (text == "")){} 
			else {
				// Alerta: "El valor ingresado no es válido")
				Alert.alert(this.props.allMessages[1], this.props.allMessages[5]);
			}
			/* Este this.setState con el await se coloca porque si el primer carácter del texto es inválido, como si por ejemplo comienza con ")", entonces
			   el this.setState de abajo no es capaz de limpiar el cuadro de texto */
			await this.setState({thickness: [[0, "0"],[0, "0"]]}); 
			
			this.setState({thickness: [[null, null],[null, null]] });
		}
	}

	// Función para actualizar los límites del resto de estratos cuando se elimina el estrato actual
	async updateStratumLimits_whenDelete(){
		let s = this.state;
		let array = s.layerList;

		function auxiliar(s,elem){
			elem.lowerLimit[0] = auxiliarFunctions.repairNumber(elem.lowerLimit[0][0] + s.previousThickness[0][0], 15);
			elem.lowerLimit[1] = auxiliarFunctions.repairNumber(elem.lowerLimit[1][0] + s.previousThickness[1][0], 15);
			elem.upperLimit[0] = auxiliarFunctions.repairNumber(elem.upperLimit[0][0] + s.previousThickness[0][0], 15);
			elem.upperLimit[1] = auxiliarFunctions.repairNumber(elem.upperLimit[1][0] + s.previousThickness[1][0], 15);		
		}

		if (s.isCore){
			for (i = this.state.index + 1; i < s.layerList.length; i++){
				auxiliar(s,array[i]);
			}
		} else {
			for (i = this.state.index - 1; i >= 0; i--){
				auxiliar(s,array[i]);
			}		
		}
		await array.splice(s.index, 1);
		return array;
	}

	// Procedimiento para eliminar el estrato actual
	deleteStratum = () => {	
		if (this.state.buttonsEnabled){
			let p = this.props;	

			// Procedimiento para eliminar el estrato actual
			let auxiliar = async(p) => {
				try {
					this.setState({buttonsEnabled: false})
					let s = this.state;
					let array = await this.updateStratumLimits_whenDelete();	

					// Los argumentos son: 1) user_id, 2) object_id, 3) layerList, 4) isCore, 5) localDB, 6) stratum_key, 7) kind = 0
					await Database.saveLayerList(p.user_id, s._id, array, s.isCore, p.localDB, s.key, 2);
					this.props.dispatchChangeLoadView(true);
					// Alerta: "El estrato fue eliminado"
					Alert.alert(p.allMessages[1], p.allMessages[6]);
					this.props.navigation.goBack();
				}
				catch(error){
					console.error(error.toString());
					this.setState({buttonsEnabled: true});
				}
			}

			// Alerta: "¿Seguro de que desea eliminar el estrato?"
			Alert.alert(p.allMessages[1], p.allMessages[7],
				[
					// Mensaje: "Sí"
					{text: p.allMessages[8], onPress: () => auxiliar(p)},
					// Mensaje: "No"
					{text: p.allMessages[9], onPress: () => this.setState({buttonsEnabled: true})},
				] 
			)
		}
	}

	// Formato de los campos numéricos que tienen dos espacios para rellenar: uno para metros y otro para pies
	// Por ahora sólo es el espesor
	doubleNumericField(variable, variableName, functionToApply){
		let p = this.props;

		function auxiliar(variable, variableName, functionToApply, unit){
			return (
				<View style = {{flexDirection: 'column', justifyContent: 'center', alignItems: 'center', paddingRight: ((unit == 0) ? 10 : 0), paddingLeft: ((unit == 0) ? 0 : 10)}}>
					<TextInput 
						value             = {variable[unit][1]}
						selectTextOnFocus = {true}
						textAlign         = {'center'}
						style             = {genericStyles.textInput}
						maxLength         = {9+unit}
						placeholder       = {p.allMessages[12]} // Mensaje: "Rellenar campo..."
						onChangeText      = {text => ((variableName != null) ? functionToApply(variableName,text,unit) : functionToApply(text,unit))}
						keyboardType      = 'phone-pad'
					/>
					{/*Mensajes: "metros" "pies"*/}
					<Text style = {{flex: 0.5, paddingTop: 3}}>{p.allMessages[15+unit]}</Text>
				</View>
			)
		}
		return(
			<View style = {{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 3}}>
				{auxiliar(variable, variableName, functionToApply, 0)}
				{auxiliar(variable, variableName, functionToApply, 1)}
			</View>
		)
	}

	/// Sirve para activar la función que lee desde la base de datos. Esto es útil cuando estamos emulando la aplicación y refrescamos la página
	// en caliente, ya que hacer eso volverá a colocar this.state.loading en su valor inicial (true) pero este componente ya estará montado, por lo que 
	// no se activará el NavigationEvents onWillFocus, y en consecuencia la vista se quedará pegada en "Cargando"
	activateLoadLayerList(){
		if (this.state.loadFunctionOpened){
			this.setState({loadFunctionOpened: false}, () => this.loadLayerList());
		}
		return(<View/>)
	}

	// Lo que se muestra al usuario en total en esta ventana
	render (){
		let s = this.state;
		let p = this.props;

		// Vista para cuando se están cargando datos desde la base de datos PouchDB
		if (s.loading){
			return (
				<View style = {genericStyles.simple_center}>
					{this.activateLoadLayerList()}
					<ActivityIndicator size = "large" color = "#0000ff" />
					{/*Mensaje: "Cargando"*/}
					<Text>{p.allMessages[10]}...</Text>
				</View>
			);	
		} 

		// Vista para cuando ya se actualizaron los datos que se quieren mostrar
		return (
			<View style = {genericStyles.lightGray_background}>

				{/*En esta parte el usuario ingresa el nombre y el espesor del estrato*/}
				<View style = {genericStyles.white_background_with_ScrollView}>
					
					<ScrollView>

						{/*Modificar el nombre del estrato*/}
						<View style = {{...genericStyles.row_instructions_textInput, paddingTop: 30}}>
							{/*Mensage: "Nombre del estrato\n(máx 35)"*/}
							<Text style = {{flex: 1, color: 'red', fontWeight: 'bold'}}>*
								<Text style = {{color: 'black'}}> {p.allMessages[11]}: </Text>
							</Text>
							<TextInput 
								defaultValue      = {this.state.stratumName} 
								selectTextOnFocus = {true}
								style             = {genericStyles.textInput}
								placeholder       = {p.allMessages[12]} // Mensaje: "Rellenar campo..."
								textAlign         = {'center'} 
								maxLength         = {35} 
								onChangeText      = {text => this.onChangeName(text)}
							/>
						</View>

						{/*Modificar el espesor del estrato*/}
						<View style = {genericStyles.instructionsAboveTextInputs}>
							{/*Mensaje: "Inserte el espesor del estrato"*/}
							<Text style = {{flex: 1, color: 'red'}}>*
								<Text style = {{color: 'black', fontWeight: 'bold'}}> {p.allMessages[13]}</Text>
							</Text>
							{/*Mensaje: "Sólo valores positivos"*/}
							<Text style = {{flex: 1}}>({p.allMessages[14]})</Text>

							{this.doubleNumericField(s.thickness, null, this.onChangeThickness)}
						</View>

						{(this.props.navigation.getParam('index') != null) &&
							<View style = {{justifyContent: 'center', alignItems: 'center', paddingTop: 80}}>
								<ButtonNoIcon 
									raised
									title   = {p.allMessages[17]} // Mensaje: "Eliminar estrato"
									color   = 'red'
									onPress = {this.deleteStratum}
								/>
							</View>
						}
					</ScrollView>
				</View>

				{/*//Vista de los botones para darle Aceptar o Volver*/}
				<View style = {genericStyles.down_buttons}>

					<View style = {{paddingRight: 25}}>
						<ButtonNoIcon 
							raised
							title   = {p.allMessages[18]} // Mensaje: "Cancelar"
							color   = {DARK_GRAY_COLOR}
							onPress = {s.keyboardAvailable ? Keyboard.dismiss : this.refuseSettings}
						/>
					</View>

					<View style = {{paddingLeft: 25}}>
						<ButtonWithIcon
							raised
							title   = {p.allMessages[19]} /// Mensaje: "Aceptar"
							icon    = {{name: 'check'}}
							onPress = {s.keyboardAvailable ? Keyboard.dismiss : this.acceptSettings}
						/>
					</View>
				</View>
			</View>
		)	
	}
}

/// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages: ObjectStratumForm_Texts[state.appPreferencesReducer.language], 
		user_id:     state.userReducer.user_id,
		localDB:     state.userReducer.localDB,
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchChangeLoadView: (bool) => dispatch(changeLoadView(bool)),
		dispatchEnteringPermission: (bool) => dispatch(changeStratumComponentPermission(bool)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(ObjectStratumForm); 