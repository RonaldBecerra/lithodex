import React, { Component } from 'react'
import { Text, View, TextInput, ScrollView, Alert, Keyboard, Picker,
		 Button as ButtonNoIcon, ActivityIndicator} from 'react-native'

import {Button as ButtonWithIcon} from 'react-native-elements'
import DatePicker from 'react-native-datepicker'

import { connect } from 'react-redux'
import { changeLoadView, changeStratumComponentPermission } from '../../redux/actions/popUpActions'
import { ObjectForm_Texts } from '../../languages/screens/objectsOfStudy/ObjectForm'

import * as Location    from 'expo-location'
import * as Permissions from 'expo-permissions'

import * as ExpoFileSystem from 'expo-file-system'
import * as ExpoDocumentPicker from 'expo-document-picker'

import PickerCheckBox from '../../modifiedLibraries/PickerCheckBox' // Uso un PickerCheckbox modificado 

import * as Log          from '../../genericFunctions/logFunctions'
import * as Database     from '../../genericFunctions/databaseFunctions'
import { genericStyles, DARK_GRAY_COLOR } from '../../constants/genericStyles'
import { UNAUTHENTICATED_ID } from '../../constants/appConstants'
import * as D from '../../constants/Dimensions'
import * as auxiliarFunctions from '../../genericFunctions/otherFunctions'
import { readCoreFile } from '../../genericFunctions/readFileFunctions'
import _ from "lodash"


class ObjectForm extends Component {

	constructor(props) {
		super(props)
		this.handleConfirm   = this.handleConfirm.bind(this)
		this.acceptSettings  = this.acceptSettings.bind(this)
		this.keyboardDidShow = this.keyboardDidShow.bind(this)
		this.keyboardDidHide = this.keyboardDidHide.bind(this)

		// Propiedades que tenemos que inicializar para manejar esta vista, independientemente de si el objeto se está creando o actualizando
		const commonProperties = {
			...this.props.navigation.state.params, // Recuperamos la información que se le pasa a esta vista
			
			// Determina si el teclado está visible. Esto lo pusimos porque no queremos que los botones de "Aceptar" y "Cancelar" de la parte inferior cierren la vista cuando el teclado está visible
			keyboardAvailable: false,
			
			loading: false, // Determina si se están cargando datos desde un archivo. Por ahora, sólo aplica en el caso de los núcleos cuando se están cargando los valores de gamma-ray

			// Determina si los botones pueden ejecutar sus respectivas funciones, lo cual impide que se presione el mismo botón 
			// por accidente dos veces seguidas, o dos botones contradictorios
			buttonsEnabled: true,
		
			// Contiene la cadena "núcleo" o "afloramiento" según sea el caso, en el idioma actual
			objectTypeMessage: (this.props.navigation.getParam('isCore') ? this.props.allMessages[0] : this.props.allMessages[1]),
		}

		// Caso en que se quiere modificar la información de un objeto ya existente
		// Hay que cargar los valores que ya estaban almacenados
		if (this.props.navigation.getParam('name')){

			this.state = {
				...commonProperties,

				// Si la altura base, la escala o la unidad de medición cambian, de todos modos necesitamos saber sus valores previos. Por eso los conservamos. 
				prevBaseHeight: this.props.navigation.getParam('baseHeight'), 
				prevScale:      this.props.navigation.getParam('scale'),   
				prevUnit:       this.props.navigation.getParam('unit'),

				gammaRayValues_changed: false,
			}
		} 
		else { // Caso en que se quiere agregar un afloramiento o núcleo nuevo
			this.state = {
				...commonProperties,

				name:                 null,
				locationInWords:      null,
				longitude:            [null,null],
				latitude:             [null,null],
				scale:                [null,null],
				layerList:            [], // Lista de estratos del afloramiento o núcleo
				numberOfItems:        0,
				date:                 null,
				unit:                 0, // La unidad será 0 en caso de que se trabaje con metros, y 1 en caso de que se trabaje con pies.
				baseHeight:           [[null,null],[null,null]], // Esto es la altura más baja en el caso de un afloramiento, y la más alta en el caso de un núcleo
				                                                 // El primer elemento del arreglo hace referencia al valor en metros, y el segundo al valor en pies.

				// Las siguientes variables indican si se muestra el campo respectivo en la columna estratigráfica para todos los estratos
				showInfo:             false,
				showLithology:        false,
				showStructure:        false, 
				showFossils:          false,
				showPictures:         false, 
				showNotes:            false, 
				showCarbonatesRule:   false,
				showNoCarbonatesRule: false,

				// Estas propiedades sólo se utilizan si estamos trabajando con núcleos
				showGammaRay:         false,
				R:                    [[null,null],[null,null]], // Profundidad del reservorio
				DF:                   [[null,null],[null,null]], // Altura donde se ubica el Drill Floor
				GL:                   [[null,null],[null,null]], // Altura del Ground Level. Inicialmente se colocará automáticamente como la altitud registrada por el GPS.
				TVD:                  [[null,null],[null,null]], // Distancia vertical entre el GL o el DF (según sea el caso) hasta el reservorio
				TVDFromGL:            false, // Determina si el True Vertical Depth se calcula desde el Ground Level. Si es falso, es porque se calcula desde el Drill Floor.
				endHeight:            [[null,null],[null,null]], // Falta ver si esta altura terminal siempre es igual al reservorio R
				gammaRayValues:       {},
			}
		}
	}

	//Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps, navigation }) => ({
		title:  (navigation.state.params.isCore) ? ObjectForm_Texts[screenProps.language][2] : ObjectForm_Texts[screenProps.language][3],
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		}
	});

	componentDidMount(){
		// Aquí inicializamos los escuchas que determinan si el teclado se está mostrando o no
		this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow);
		this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide);

		// Para registrar en el "log" que se entró en esta vista para aadir o editar un objeto de estudio
		Log.log_action({entry_code: (this.props.navigation.getParam('name') ? 7 : 5), user_id: this.props.user_id, isCore: this.state.isCore, object_id: this.state._id});

		// Llamar al procedimiento que obtiene la ubicación actual
		this._getLocationAsync() 
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

	// Procedimiento que obtiene la ubicación actual
	_getLocationAsync  = async () => {
		let { status } = await Permissions.askAsync(Permissions.LOCATION);
		if (status === 'granted') {
			const geographicLocation = await Location.getCurrentPositionAsync({enableHighAccuracy: true});
			
			let longitude = JSON.stringify(geographicLocation.coords.longitude);
			let latitude  = JSON.stringify(geographicLocation.coords.latitude);
			let altitude  = JSON.stringify(geographicLocation.coords.altitude).substring(0,10);

			if ((this.state.latitude[0] == null) && (this.state.longitude[0] == null)){
				this.onChangeGeographicCoordinate('latitude',latitude);
				this.onChangeGeographicCoordinate('longitude',longitude);
			}

			if (this.props.navigation.getParam('isCore')){
				// En el caso de los núcleos la altitud actual la registramos como el Ground Level.
				// Esto asumiendo que el registro se hace en el lugar de estudio. De todos modos esto se puede cambiar.
				if (!this.props.navigation.getParam('GL')){
					this.onChangeDF_GL('GL',altitude, 0);
				}
			} else if (!this.props.navigation.getParam('baseHeight')){
				// En el caso de los afloramientos asumimos que la altitud actual es la altura base del afloramiento
				this.onChangeBase_EndHeight('baseHeight',altitude,0);
			}
		}
	}

	// Función genérica para todos los casos en los que el dato ingresado es un texto plano
	onChangePlainText = (variableName, text) => {
		if ((text == " ") || (text == "")){
			text = null;
		}
		let object = {};
		object[variableName] = text;
		this.setState(object);	
	}

	// Procedimiento para cambiar la altura que puede ser la base o la terminal
	// * Recuérdese que la altura base es donde comienza el objeto (la parte más alta en núcleos y la más baja en afloramientos)
	// * La altura terminal sólo la estamos definiendo para núcleos, y es su parte más baja registrada, aunque por ahora
	//   no estamos usando ese valor en ninguna otra parte.
	onChangeBase_EndHeight = async(variableName, text, unit) => {
		let result;
		let object = {};

		if (auxiliarFunctions.isValidDecimalNumber(text)){
			if (text != "-"){
				if (unit == 0){ // Caso en que el valor provisto fue el de metros
					result = [[parseFloat(text), text], auxiliarFunctions.metersToFeet(text)];
				}
				else { // Caso en que el valor provisto fue el de pies
					result = [auxiliarFunctions.feetToMeters(text), [parseFloat(text),text]];	
				}
			} else {
				result = [[null, "-"], [null, "-"]];
			}
		} else {
			if ((text == " ") || (text == "")){} 
			else {
				// Alerta: "El valor ingresado no es válido"
				Alert.alert(this.props.allMessages[4], this.props.allMessages[5]);
			}
			/* Este this.setState con el await se coloca porque si el primer carácter del texto es inválido, como si por ejemplo comienza con ")", entonces
			   el this.state de abajo no es capaz de limpiar el cuadro de texto */
			object[variableName] = [[0, "0"],[0, "0"]];
			await this.setState(object); 
			result = [[null, null],[null, null]];
		}
		object[variableName] = result;
		this.setState(object);
	}

	// Procedimiento para cambiar la coordenada geográfica correspondiente (latitud o longitud)
	onChangeGeographicCoordinate = async(variableName, text) => {
		let result;
		let object = {};

		if (auxiliarFunctions.isValidDecimalNumber(text)){
			if (text != "-"){
				result = [parseFloat(text), text];
			}
			else {
				result = [null, text]
			}
		} else {
			if ((text == " ") || (text == "")){}
			else {
				// Alerta: "El valor ingresado no es válido"
				Alert.alert(this.props.allMessages[4], this.props.allMessages[5]);
			}
			/* Este this.setState con el await se coloca porque si el primer carácter del texto es inválido, como si por ejemplo comienza con ")", entonces
			   el this.setState de abajo no es capaz de limpiar el cuadro de texto */
			object[variableName] = [0,"0"];
			await this.setState(object);
			result = [null,null];
		}
		object[variableName] = result;
		this.setState(object);
	}

	// Procedimiento que se llama cuando cambia la escala
	onChangeScale = async(text) => {
		if (auxiliarFunctions.isValidPositiveDecimalNumber(text)){
			this.setState({scale: [parseFloat(text), text]});
		} else {
			if ((text == "") || (text == " ")){}
			else {
				// Alerta: "El valor ingresado no es válido"
				Alert.alert(this.props.allMessages[4], this.props.allMessages[5]);
			}
			/* Este this.setState con el await se coloca porque si el primer carácter del texto es inválido, como si por ejemplo comienza con ")", entonces
			   el this.setState de abajo no es capaz de limpiar el cuadro de texto */
			await this.setState({scale: [0, "0"]}); 
			
			this.setState({scale: [null,null]});
		}
	}

	// Para cambiar si el TVD se calcula desde el GL o desde el DF
	onCalculateFromGL_DF = async(value) => {
		await this.setState({TVDFromGL: value});
		if (this.state.TVD[0][0] != null){
			if (value){
				if (this.state.GL[0][0] != null) {
					const differenceMeters = this.state.GL[0][0] - this.state.TVD[0][0];
					const differenceFeet   = this.state.GL[1][0] - this.state.TVD[1][0];
					await this.setState({R: [differenceMeters, differenceFeet]});
				} 
				else{ 
					await this.setState({R: [[null,null],[null,null]]});
				}
			} else {
				if (this.state.DF[0] != null){
					const R_meters = auxiliarFunctions.repairNumber(this.state.DF[0][0] - this.state.TVD[0][0], 15);
					const R_feet   = auxiliarFunctions.repairNumber(this.state.DF[1][0] - this.state.TVD[1][0], 15);
					await this.setState({R: [R_meters,R_feet]});
				}
				else {
					await this.setState({R: [[null,null],[null,null]]});
				}
			}
		} else {
			await this.setState({R: [[null,null],[null,null]]});
		}
	}

	// Procedimiento que se usa en el caso de los núcleos
	// Puede servir para cambiar la altura a la que está ubicada la plataforma (Drill Floor)
	// o bien para cambiar la altura sobre el nivel del suelo (Ground Level)
	onChangeDF_GL = async(variableName, text, unit) => {
		let result;
		let object = {};
		const TVD_notNull = (this.state.TVD[0][0] != null);
		const conditionDF = (variableName === 'DF') && (!this.state.TVDFromGL);
		const conditionGL = (variableName === 'GL') && this.state.TVDFromGL;

		if (auxiliarFunctions.isValidDecimalNumber(text)){
			if (text != "-"){
				if (unit == 0){ // Caso en que el valor provisto fue el de metros
					var valueMeters = [parseFloat(text), text];
					var valueFeet   = auxiliarFunctions.metersToFeet(text);		
				}
				else { // Caso en que el valor provisto fue el de pies
					var valueMeters = auxiliarFunctions.feetToMeters(text);
					var valueFeet   = [parseFloat(text), text];
				}
				result = [valueMeters, valueFeet];

				// Como tenemos el TVD y el valor desde el que está calculado, cambiamos la profundidad del reservorio
				if ((conditionDF || conditionGL) && TVD_notNull){
					const R_meters = auxiliarFunctions.repairNumber(valueMeters[0] - this.state.TVD[0][0], 15);
					const R_feet   = auxiliarFunctions.repairNumber(valueFeet[0] - this.state.TVD[1][0], 15);
					this.setState({R: [R_meters,R_feet]});
				}	
			} else {
				result = [[null, "-"], [null, "-"]];

				// Como no tenemos el valor desde el que está calculado el TVD, la profunidad del reservorio tiene que ser nula
				if (conditionDF || conditionGL){
					this.setState({R: [[null,null],[null,null]]});
				}
			}	
		} else {
			if ((text == "") || (text == " ")){} 
			else {
				// Alerta: "El valor ingresado no es válido"
				Alert.alert(this.props.allMessages[4], this.props.allMessages[5]);
			}

			// Como no tenemos el valor desde el que está calculado el TVD, la profunidad del reservorio tiene que ser nula
			if (conditionDF || conditionGL){
				this.setState({R: [[null,null],[null,null]]});
			}
			/* Este this.setState con el await se coloca porque si el primer carácter del texto es inválido, como si por ejemplo comienza con ")", entonces
			   el this.setState de abajo no es capaz de limpiar el cuadro de texto */
			object[variableName] = [0,"0"];
			await this.setState(object);
			result = [[null, null],[null, null]];
		}
		object[variableName] = result;
		this.setState(object);
	}

	// Procedimiento para cambiar la distancia vertical de excavación
	onChangeTVD = async(text, unit) => {
		if (auxiliarFunctions.isValidPositiveDecimalNumber(text)){	
			if (unit == 0){ // Caso en que el valor provisto fue el de metros
				var valueMeters = [parseFloat(text), text];
				var valueFeet   = auxiliarFunctions.metersToFeet(text);
			}
			else { // Caso en que el valor provisto fue el de pies
				var valueMeters = auxiliarFunctions.feetToMeters(text);
				var valueFeet   = [parseFloat(text), text];
			}
			this.setState({TVD: [valueMeters, valueFeet]});	

			if ((this.state.TVDFromGL) && (this.state.GL[0][0] != null)){
				const R_meters = auxiliarFunctions.repairNumber(this.state.GL[0][0] - valueMeters[0], 15);
				const R_feet   = auxiliarFunctions.repairNumber(this.state.GL[1][0] - valueFeet[0], 15);
				this.setState({R: [R_meters,R_feet]});
			} 
			else if (!(this.state.TVDFromGL) && (this.state.DF[0][0] != null)){
				const R_meters = auxiliarFunctions.repairNumber(this.state.DF[0][0] - valueMeters[0], 15);
				const R_feet   = auxiliarFunctions.repairNumber(this.state.DF[1][0] - valueFeet[0], 15);
				this.setState({R: [R_meters,R_feet]});					
			}	

		} else {
			if ((text == " ") || (text == "")){} 
			else {
				// Alerta: "El valor ingresado no es válido"
				Alert.alert(this.props.allMessages[4], this.props.allMessages[5]);	
			}
			/* Este this.setState con el await se coloca porque si el primer carácter del texto es inválido, como si por ejemplo comienza con ")", entonces
			   el this.setState de abajo no es capaz de limpiar el cuadro de texto */
			await this.setState({TVD: [[0, "0"],[0, "0"]]}); 
			
			this.setState({TVD: [[null, null],[null, null]], R: [[null,null],[null,null]]});
		}
	}

	// Procedimiento para buscar el archivo con el que se obtendrán los valores para generar la(s) gráfica(s).
	selectCoreFile = async() => {
		try{
			this.setState({buttonsEnabled: false});
			const file = await ExpoDocumentPicker.getDocumentAsync("*/*"); 
			if (file.type === 'success'){
				this.setState({loading: true});

				const fileContent = await ExpoFileSystem.readAsStringAsync(file.uri)
				const result      = await readCoreFile(fileContent);

				// Caso en que no se pudo leer el archivo
				if (result == null){
					// Alerta: "Ocurrió un error al tratar de leer el archivo"
					Alert.alert(this.props.allMessages[4], this.props.allMessages[6]);
					this.setState({buttonsEnabled: true, loading: false});
				}
				else {
					
					// Caso en que tenemos que actualizar el Drill Floor a partir del archivo
					if (result.DF.length != 0){
						this.onChangeDF_GL('DF', result.DF[0], result.DF[1]);
					}
					
					// Caso en que tenemos que actualizar el Ground Level a partir del archivo
					if (result.GL.length != 0){
						this.onChangeDF_GL('GL',result.GL[0], result.GL[1]);
					}

					// Caso en que tenemos que actualizar la altura base a partir del archivo
					if (result.BaseHeight.length != 0){
						await this.onChangeBase_EndHeight('baseHeight', result.BaseHeight[0], result.BaseHeight[1]);
					}

					// Caso en que tenemos que actualizar la altura terminal a partir del archivo
					if (result.EndHeight.length != 0){
						this.onChangeBase_EndHeight('endHeight', result.EndHeight[0], result.EndHeight[1]);
					}

					// Caso en que tenemos que actualizar la escala a partir del archivo
					if (result.Scale.length != 0){
						this.setState({scale: result.Scale[0], unit: result.Scale[1]});
					}

					// Actualizar la tabla de valores de gamma-ray (siempre hay que hacerlo)
					if (0 < result.gammaRayValues.xValuesMeters.length){
						this.setState({gammaRayValues: result.gammaRayValues, gammaRayValues_changed: true, buttonsEnabled: true, loading: false});

						// Alerta: "El archivo fue leído exitosamente"
						Alert.alert(this.props.allMessages[4], this.props.allMessages[7]);
					}
					else {
						this.setState({buttonsEnabled: true, loading: false});

						// Alerta: "No se obtuvo ninguna información de rayos-gamma"
						Alert.alert(this.props.allMessages[4], this.props.allMessages[8]);
					}
				}
			}
			else if (file.type === 'cancel'){
				this.setState({buttonsEnabled: true});
			}
			else{
				// Alerta: "Ocurrió un error al tratar de leer el archivo"
				Alert.alert(this.props.allMessages[4], this.props.allMessages[9]);
				this.setState({buttonsEnabled: true});
			}
		} catch(error){
			// Expo no se construyó con iCloud, expo turtle fallback
			console.error(error.toString());
			this.setState({buttonsEnabled: true});
		}
	}

	/* Procedimiento para actualizar la altura base en todos los estratos
	   Sólo se le llama cuando estamos actualizando un núcleo ya existente

	   Nota: Antes había pensando en calcular la diferencia entre la altura base anterior y la actual, y sumársela a los
	   límites de todos los estratos. Pero eso trae inconsistencias por el problema de la aproximación. Por ejemplo,
	   un estrato podía quedar con espesor 4, límite inferior 849.3m y límite superior 853.29999m. La diferencia entre el
	   límite superior y el inferior no es exactamente 4 en ese caso.
	 */
	updateLayersWithBaseHeight = (baseHeight) => {
		let s = this.state;
		let len = s.layerList.length; // Cantidad de estratos registrados

		if (len > 0){
			// La actualización de los estratos es diferente dependiendo de si se trata de un núcleo o un afloramiento
			if (s.isCore){
				// Comenzamos modificando el estrato superior (recuérdese que el superior siempre es el más alto)
				let currentLayer = s.layerList[0];

				currentLayer.upperLimit = _.cloneDeep(s.baseHeight);	

				currentLayer.lowerLimit[0] = auxiliarFunctions.repairNumber(currentLayer.upperLimit[0][0] - currentLayer.thickness[0][0], 15);
				currentLayer.lowerLimit[1] = auxiliarFunctions.repairNumber(currentLayer.upperLimit[1][0] - currentLayer.thickness[1][0], 15);

				let previousLayer = currentLayer;

				// Modificamos el resto de estratos
				for (i = 1; i < len; i++){
					currentLayer = s.layerList[i];

					currentLayer.upperLimit = _.cloneDeep(previousLayer.lowerLimit);

					currentLayer.lowerLimit[0] = auxiliarFunctions.repairNumber(currentLayer.upperLimit[0][0] - currentLayer.thickness[0][0], 15);
					currentLayer.lowerLimit[1] = auxiliarFunctions.repairNumber(currentLayer.upperLimit[1][0] - currentLayer.thickness[1][0], 15);

					previousLayer = currentLayer;
				}
			} else {
				// Comenzamos modificando el estrato inferior
				let currentLayer = s.layerList[len-1];

				currentLayer.lowerLimit = _.cloneDeep(s.baseHeight);

				currentLayer.upperLimit[0] = auxiliarFunctions.repairNumber(currentLayer.lowerLimit[0][0] + currentLayer.thickness[0][0], 15);
				currentLayer.upperLimit[1] = auxiliarFunctions.repairNumber(currentLayer.lowerLimit[1][0] + currentLayer.thickness[1][0], 15);

				let previousLayer = currentLayer;

				// Modificamos el resto de estratos
				for (i = len-2; i >= 0; i--){
					currentLayer = s.layerList[i];

					currentLayer.lowerLimit = _.cloneDeep(previousLayer.upperLimit);

					currentLayer.upperLimit[0] = auxiliarFunctions.repairNumber(currentLayer.lowerLimit[0][0] + currentLayer.thickness[0][0], 15);
					currentLayer.upperLimit[1] = auxiliarFunctions.repairNumber(currentLayer.lowerLimit[1][0] + currentLayer.thickness[1][0], 15);

					previousLayer = currentLayer;
				}				
			}
		}	
	}

	// Procedimiento para actualizar el espesor con el que se muestran todos los estratos en el OutcropScreen
	// Sólo se le llama cuando estamos actualizando un afloramiento o núcleo ya existente
	updateLayersThickness = (scale) => {
		let s = this.state;
		const factor = D.SIZE_OF_UNIT * (1/scale[0]);

		for (i = 0; i < s.layerList.length; i++) {
			var currentLayer = s.layerList[i];
			currentLayer.shownHeight = [factor * currentLayer.thickness[0][0], factor * currentLayer.thickness[1][0]];
		}	
	}

	// Procedimiento para seleccionar qué campos de los estratos serán visibles en la ventana de las gráficas
	handleConfirm = async(selectedItems) => {
		let s = this.state;
		var arrayLength = selectedItems.length;
		var count = s.numberOfItems;

		for (var i = 0; i < arrayLength; i++) {

			switch(selectedItems[i].itemKey){
				case 1:
					(!s.showGammaRay) ? (count += 1) : (count -= 1);
					await this.setState({showGammaRay: !s.showGammaRay});
					break;

				case 2:
					(!s.showInfo) ? (count += 1) : (count -= 1);
					await this.setState({showInfo: !s.showInfo});
					break;

				case 3:
					(!s.showLithology) ? (count += 1) : (count -= 1);
					await this.setState({showLithology: !s.showLithology});
					break;

				case 4:
					(!s.showStructure) ? (count += 1) : (count -= 1);
					await this.setState({showStructure: !s.showStructure});
					break;

				case 5:
					(!s.showFossils) ? (count += 1) : (count -= 1);
					await this.setState({showFossils: !s.showFossils});
					break;

				case 6:
					(!s.showPictures) ? (count += 1) : (count -= 1);
					await this.setState({showPictures: !s.showPictures});
					break;

				case 7:
					(!s.showNotes) ? (count += 1) : (count -= 1);
					await this.setState({showNotes: !s.showNotes});
					break;

				case 8:
					(!s.showNoCarbonatesRule) ? (count += 1) : (count -= 1);
					await this.setState({showNoCarbonatesRule: !s.showNoCarbonatesRule});
					break;

				case 9:
					(!s.showCarbonatesRule) ? (count += 1) : (count -= 1);
					await this.setState({showCarbonatesRule: !s.showCarbonatesRule});
					break;

				default:
					break;
			}
		}
		await this.setState({numberOfItems: count});
	}

	// Procedimiento para hacer los cambios correspondientes en la base de datos (creación o actualización)
	acceptSettings = () => {    
		let s = this.state;
		let p = this.props;
		let baseHeightMeters, endHeightMeters;
		let correctFields = true;

		if (this.state.buttonsEnabled){ // No usar la abreviatura "s" porque puede estar desactualizada
			if (s.name == null){
				// Alerta: "El nombre del [núcleo/afloramiento] no puede ser nulo"
				Alert.alert(p.allMessages[4], p.allMessages[10](s.objectTypeMessage));
				correctFields = false;
			}
			else if (s.scale[0] == 0){
				// Alerta: "La escala no puede ser cero"
				Alert.alert(p.allMessages[4], p.allMessages[11]);
				correctFields = false;
			}
			else if (s.isCore){
				baseHeightMeters = s.baseHeight[0][0];
				endHeightMeters  = s.endHeight[0][0];

				if ((endHeightMeters != null) && (baseHeightMeters != null) && (endHeightMeters >= baseHeightMeters)){
					// Alerta: "La altura base debe ser mayor que la altura terminal"
					Alert.alert(p.allMessages[4], p.allMessages[12]);
					correctFields = false;
				}
				else if (!( (s.DF[0][0] == null) || (s.GL[0][0] == null) ) && (s.DF[0][0] <= s.GL[0][0])){
					// Alerta: "El nivel del DF debe ser mayor que el GL"
					Alert.alert(p.allMessages[4], p.allMessages[13]);
					correctFields = false;
				}
				else if ( (s.GL[0][0] != null) && (baseHeightMeters != null) && (baseHeightMeters > s.GL[0][0]) ){
					// Alerta: "La altura base debe ser menor o igual que el GL"
					Alert.alert(p.allMessages[4], p.allMessages[14]);
					correctFields = false;
				}
				else if ( (s.GL[0][0] != null) && (endHeightMeters != null) && (endHeightMeters >= s.GL[0][0]) ){
					// Alerta: "La altura terminal debe ser menor que el GL"
					Alert.alert(p.allMessages[4], p.allMessages[15]);
					correctFields = false;
				}
				else if (s.gammaRayValues.hasOwnProperty('xValuesMeters') && (s.gammaRayValues.xValuesMeters[0] > baseHeightMeters)){
					// Alerta: "La altura base no puede ser menor que la altura más alta leída para los rayos gamma: "
					Alert.alert(p.allMessages[4], p.allMessages[16] + s.gammaRayValues.xValuesMeters[0] + "m / " + s.gammaRayValues.xValuesFeet[0] + "ft");
					correctFields = false;
				}
			}
			if (correctFields) {
				this.setState({buttonsEnabled: false},
					async() => {
						var newScale   = s.scale;
						var newUnit    = s.unit
						var baseHeight = s.baseHeight;

						// Arreglar la escala
						if (newScale[0] == null){
							newScale = [1,"1"];  // Por defecto, la escala será 1
						}

						// Arreglar la altura base
						if (baseHeight[0][0] == null){
							baseHeight = [[0,"0"],[0,"0"]];

							// En el caso de los núcleos hay otras consideraciones
							if (s.isCore){
								if (s.GL[0][0] != null){
									// Si el Ground Level no es cero, hacemos que la altura base sea la misma
									await this.onChangeBase_EndHeight('baseHeight',s.GL[0][1], 0);
									baseHeight = this.state.baseHeight;
								}
								else if ((endHeightMeters != null) && (endHeightMeters > 0)){
									// Si la altura terminal no es cero, hacemos que la base sea una unidad mayor
									await this.onChangeBase_EndHeight('baseHeight',(endHeightMeters+1).toString(), 0);
									baseHeight = this.state.baseHeight;
								}
							}
						}
							
						// Caso en que estamos modificando un núcleo o afloramiento existente
						if (this.props.navigation.getParam('name')){
							// Caso en que la altura base cambió: debemos actualizar los límites de todos los estratos
							if (baseHeight != s.prevBaseHeight){
								await this.updateLayersWithBaseHeight(baseHeight);
							}
							// Caso en que la escala o la unidad cambiaron: debemos actualizar los espesores de todos los estratos
							if ((newScale != s.prevScale) || (newUnit != s.prevUnit)){
								await this.updateLayersThickness(newScale);
							}
						}
						let payload;
						const isNew = p.navigation.getParam('name') ? false : true;

						// Si estamos creando un nuevo afloramiento o núcleo, le creamos un identificador
						const _id = isNew ? auxiliarFunctions.generateObject_id() : s._id;

						// En el caso de los núcleos guardamos más propiedades que en los afloramientos
						if (s.isCore){
							let {name, locationInWords, longitude, latitude, showInfo, showLithology, showGammaRay, showStructure, showPictures, showFossils, showNotes, 
								showCarbonatesRule, showNoCarbonatesRule, layerList, numberOfItems, date, unit, R, DF, GL, TVD, TVDFromGL, endHeight, gammaRayValues, gammaRayValues_changed} = this.state;

							payload = {
								_id, name, locationInWords, longitude, latitude, showInfo, showLithology, showGammaRay, showStructure, showPictures, showFossils, showNotes, 
								showCarbonatesRule, showNoCarbonatesRule, layerList, numberOfItems, date, unit, R, DF, GL, TVD, TVDFromGL, endHeight, gammaRayValues, gammaRayValues_changed,
								
								scale: newScale, baseHeight, // Valores que puede que hayamos tenido que actualizar en esta función
							}
						} else {
							let {name, locationInWords, longitude, latitude, showInfo, showLithology, showStructure, showFossils, showPictures, showNotes, showCarbonatesRule, 
								showNoCarbonatesRule, layerList, numberOfItems, date, unit} = this.state;

							payload = {
								_id, name, locationInWords, longitude, latitude, showInfo, showLithology, showStructure, showFossils, showPictures, showNotes, showCarbonatesRule, 
								showNoCarbonatesRule, layerList, numberOfItems, date, unit,

								scale: newScale, baseHeight, // Valores que puede que hayamos tenido que actualizar en esta función
							}
						}
						
						await Database.saveObjectOfStudyInfo(payload, s.isCore, isNew, p.user_id, _id, p.localDB);

						// Si vamos a regresar a la ventana de las gráficas, tenemos que hacer que ella vuelva a cargar datos desde la base de datos
						if (p.navigation.getParam("returnToObjectScreen")){
							p.dispatchChangeLoadView(true);
						}
						p.navigation.goBack();
					}
				)
			}
		}
	}

	// Procedimiento para el caso en que el usuario le da al botón de Cancelar
	refuseSettings = () => {
		this.setState({buttonsEnabled: false});
		if (this.props.navigation.getParam('name')){
			// Alerta: "No se salvaron los cambios"
			Alert.alert(this.props.allMessages[4], this.props.allMessages[17]);			
		}
		this.props.navigation.goBack();
	}

	// Formato de los campos que consisten en texto plano
	plainTextField(mainMessage, variable, variableName, cannotBeEmpty, maxLength){
		return(
			<View style = {genericStyles.row_instructions_textInput}>
				{cannotBeEmpty && // Caso en que el campo es obligatorio
					<View style = {{flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
						<Text style = {{flex: 1, color: 'red', fontWeight: 'bold'}}>*
							<Text style = {{color: 'black'}}> {mainMessage}: </Text> 
						</Text>
					</View>
				}
				{!cannotBeEmpty && /// Caso en que el campo NO es obligatorio
					<View style = {{flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
						<Text style = {{flex:1}}>{mainMessage}</Text>
					</View>
				}
				<TextInput 
					defaultValue      = {variable}
					selectTextOnFocus = {true}
					textAlign         = {'center'} 
					style             = {genericStyles.textInput}
					placeholder       = {this.props.allMessages[29]} // Mensaje: "Rellenar campo..."
					maxLength         = {maxLength}
					onChangeText      = {text => this.onChangePlainText(variableName,text)}
				/>
			</View>
		)
	}

	// Formato de los campos numéricos que tienen un solo espacio para rellenar
	singleNumericField(mainMessage, variable, variableName, functionToApply, maxLength){
		return(
			<View style = {genericStyles.row_instructions_textInput}>
				<Text style = {{flex:1}}>{mainMessage}</Text>
				<TextInput 
					value             = {variable[1]} 
					selectTextOnFocus = {true}
					textAlign         = {'center'}
					style             = {genericStyles.textInput} 
					maxLength         = {maxLength}
					placeholder       = {this.props.allMessages[29]} /// Mensaje: "Rellenar campo..."
					onChangeText      = {text => ((variableName != null) ? functionToApply(variableName,text) : functionToApply(text))}
					keyboardType      = 'phone-pad'
				/>
			</View>
		)
	}

	/// Formato de los campos numéricos que tienen dos espacios para rellenar: uno para metros y otro para pies
	doubleNumericField(mainMessage, variable, variableName, functionToApply, secondMessage){
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
						placeholder       = {p.allMessages[29]} // Mensaje: "Rellenar campo..."
						onChangeText      = {text => ((variableName != null) ? functionToApply(variableName,text,unit) : functionToApply(text,unit))}
						keyboardType      = 'phone-pad'
					/>
					{/*Mensajes: "metros" "pies"*/}
					<Text style = {{flex: 0.5, paddingTop: 3}}>{p.allMessages[41+unit]}</Text>
				</View>
			)
		}
		return(
			<View style = {genericStyles.instructionsAboveTextInputs}>
				<Text style = {{flex: 1}}>{mainMessage}</Text>
				{(secondMessage != null) && /// Caso en que el mensaje consta de dos partes
					<View style = {genericStyles.simple_center}>
						<Text style = {{flex: 1}}>{secondMessage}</Text>
					</View>
				}
				<View style = {{flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 3}}>
					{auxiliar(variable, variableName, functionToApply, 0)}
					{auxiliar(variable, variableName, functionToApply, 1)}
				</View>
			</View>
		)
	}

	// Lo que se le mostrará al usuario
	render() {
		let s = this.state;
		let p = this.props;

		// Estos arreglos se utilizan en el PickerCheckBox, donde el usuario decide qué campos se muestran en la gráfica
																 //     Mensajes
		let checkboxElements = [
			{ itemKey:2, itemDescription: p.allMessages[18]}, // "Información de estrato"
			{ itemKey:3, itemDescription: p.allMessages[19]}, //      "Litología"
			{ itemKey:4, itemDescription: p.allMessages[20]}, // "Estructura sedimentaria"
			{ itemKey:5, itemDescription: p.allMessages[21]}, //       "Fósiles"
			{ itemKey:6, itemDescription: p.allMessages[22]}, //     "Fotografías"
			{ itemKey:7, itemDescription: p.allMessages[23]}, //    "Notas de texto"
			{ itemKey:8, itemDescription: p.allMessages[24]}, // "Regla de no carbonatos"
			{ itemKey:9, itemDescription: p.allMessages[25]}, //  "Regla de carbonatos"
		];

		let arrayOfValues = [s.showInfo,s.showLithology,s.showStructure,s.showFossils,
							 s.showPictures,s.showNotes,s.showNoCarbonatesRule,s.showCarbonatesRule];
		let totalItems = 8;

		if (s.isCore){
			checkboxElements.unshift({itemKey:1, itemDescription: p.allMessages[26]}) // Mensaje: "Gráfica de rayos gamma"
			arrayOfValues.unshift(s.showGammaRay)
			totalItems = 9;
		}

		// Esto permite que cuando se vuelva a entrar en el PickerCheckBox, estén marcados los elementos que habían sido seleccionados previamente
		let selectedItemsProv = []
		for (i = 0; i < totalItems; i++){
			if (arrayOfValues[i]){
				selectedItemsProv.push(checkboxElements[i])
			}
		}

		// Vista para cuando se están leyendo datos desde un archivo
		if (s.loading){
			return (
				<View style = {genericStyles.simple_center}>
					<ActivityIndicator size = "large" color = "#0000ff" />
					{/*Mensaje: "Cargando"*/}
					<Text>{p.allMessages[27]}...</Text>
				</View>
			);	
		} 

		// Vista normal, cuando no se está leyendo ningún archivo
		return (
			<View style = {genericStyles.lightGray_background}>

				{/*Primer sector con fondo blanco, que incluye todos los campos a rellenar*/}
				<View style = {genericStyles.white_background_with_ScrollView}>
					<ScrollView>

						{/*Mensaje: "Nombre del objeto\n(máx 50)"*/}
						{this.plainTextField(p.allMessages[28], s.name, 'name', true, 50)}

						{/*Modificar la fecha*/}
						<View style = {genericStyles.row_instructions_textInput}>
							{/*Mensaje: "Fecha de registro"*/}
							<Text style = {{flex:1}}>{p.allMessages[30]}: </Text>
							<DatePicker
								style          = {{flex: 1.05, height: 35, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'black'}}
								date           = {s.date}
								mode           = "date"
								placeholder    = {p.allMessages[31]} /// Mensaje: "Toque para escoger..."
								format         = "DD-MM-YYYY"
								minDate        = "01-01-2010"
								confirmBtnText = {p.allMessages[32]} // Mensaje: "Ok"
								cancelBtnText  = {p.allMessages[33]} // Mensaje: "Cancelar"
								showIcon       = {false}
								defaultValue   = {p.allMessages[34]} // Mensaje: "Falta por establecer"
								customStyles   = {{
									///dateIcon: {postion: 'absolute'}
									dateInput: {...genericStyles.textInput, padding: 0, borderColor: 'transparent'},
								}}
								onDateChange = {(date) => {this.setState({date: date})}}
							/>
						</View>

						{/*//Mensaje: "Localización"*/}
						{this.plainTextField(p.allMessages[35], s.locationInWords, 'locationInWords', false, null)}

						{s.isCore && 
							<View>
								{/*Mensaje: "Archivo para cargar datos del núcleo"*/}
								<Text style = {genericStyles.subtitle}>{p.allMessages[36]}</Text>

								{/*//Seleccionar el archivo desde el que se leen los datos de los rayos gamma, y quizás otros datos*/}
								<View style = {genericStyles.row_instructions_textInput}>
									<ButtonWithIcon
										raised
										title   = {auxiliarFunctions.isEmptyObject(s.gammaRayValues) ? p.allMessages[37][0] : p.allMessages[37][1]} // Mensajes: "Leer archivo" "Cambiar archivo existente"
										icon    = {{name: 'description'}}
										onPress = {this.state.buttonsEnabled ? () => {this.selectCoreFile()} : () => {}}
									/>
								</View>
							</View>
						}

						{/*Mensaje: "Latitud: "*/}
						{this.singleNumericField(p.allMessages[38], s.latitude, 'latitude', this.onChangeGeographicCoordinate, null)}

						{/*Mensaje: "Longitud: "*/}
						{this.singleNumericField(p.allMessages[39], s.longitude, 'longitude', this.onChangeGeographicCoordinate, null)}

						{s.isCore && 
							<View>
								{/*Mensaje: "Altura del 'Drill Floor' (DF) con respecto al nivel del mar"*/}
								{this.doubleNumericField(p.allMessages[40], s.DF, 'DF', this.onChangeDF_GL, null)}

								{/*Mensaje: "Altura del 'Ground Level' (GL) con respecto al nivel del mar"*/}
								{this.doubleNumericField(p.allMessages[43], s.GL, 'GL', this.onChangeDF_GL, null)}

								{/*Determinar si el TVD se calcula a partir del GL o desde el DF*/}
								<View style = {genericStyles.row_instructions_textInput}>
									{/*Mensaje: "Determine desde qué punto se calcula el TVD" */}
									<Text style = {{flex:1}}>{p.allMessages[44]}</Text>
									<Picker
										selectedValue = {s.TVDFromGL}
										style         = {{height: 30, width: 100, flex: 1}}
										onValueChange = {(itemValue, itemIndex) => this.onCalculateFromGL_DF(itemValue)}
									>
										<Picker.Item label = {p.allMessages[45]}    value = {false}/>
										<Picker.Item label = {p.allMessages[46]}    value = {true}/>
									</Picker>
								</View>

								{/*Mensajes: "Medida del 'True Vertical Depth' (TVD)"  "(Sólo valores positivos)"*/}
								{this.doubleNumericField(p.allMessages[47], s.TVD, null, this.onChangeTVD, p.allMessages[48])}
							</View>
						}

						{/*//Mensajes: "Altura de inicio (la más alta) con respecto al nivel del mar"  "Altura base con respecto al nivel del mar"*/}
						{this.doubleNumericField(p.allMessages[(s.isCore ? 49 : 50)], s.baseHeight, 'baseHeight', this.onChangeBase_EndHeight, null)}

						{s.isCore && 
							<View>
								{/*Mensaje: "Altura terminal con respecto al nivel del mar"*/}
								{this.doubleNumericField(p.allMessages[51], s.endHeight, 'endHeight', this.onChangeBase_EndHeight, null)}
							</View>
						}

						{/*//Mensaje: "Información de gráfica"*/}
						<Text style = {genericStyles.subtitle}>{p.allMessages[52]}</Text>

						{/*//Mensaje: "Escala vertical"*/}
						{this.singleNumericField(p.allMessages[53] + " (1:" + ((s.scale[0] == null) ? "?" : s.scale[1]) + ")", s.scale, null, this.onChangeScale, 9)}

						{/*Escoger las unidades de medición (metros o pies) que se usarán en la gráfica*/}
						<View style = {genericStyles.row_instructions_textInput}>
							{/*Mensaje: "Unidades de medición"*/}
							<Text style = {{flex:1}}>{p.allMessages[54]}: </Text>
							<Picker
								selectedValue = {s.unit}
								style         = {{height: 30, width: 100, flex: 1}}
								onValueChange = {(itemValue, itemIndex) => this.setState({unit: itemValue})}
							>
								<Picker.Item label = {p.allMessages[55]}  value = {0}/>
								<Picker.Item label = {p.allMessages[56]}  value = {1}/>
							</Picker>
						</View>

						{/*Modificar los campos que se mostrarán la gráfica*/}
						<View style = {{flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 10, paddingTop: 10, paddingBottom: 45, height: 80}}>
							{/*Mensaje: "Campos a mostrar"*/}
							<Text style = {{flex:2}}>{"\n"}{p.allMessages[57]}:</Text>
							<View style = {{flex:1, height: 15, width:250}}>
								<PickerCheckBox
									data                     = {checkboxElements}              
									style                    = {{flex:1, height: 15, width:250}} 
									headerComponent          = {<Text style = {{fontSize:25}}>{p.allMessages[58]}</Text>} // Mensaje: "Tipos de registro"
									OnConfirm                = {(selectedItems) => this.handleConfirm(selectedItems)}
									checkedItems             = {selectedItemsProv} // Elementos que se muestran señalados cuando se abre el formulario
									ConfirmButtonTitle       = {p.allMessages[59]} // Mensaje: "Aceptar"
									arrowSize                = {20}
									DescriptionField         = 'itemDescription'
									KeyField                 = 'itemKey'
									arrayOfValues            = {arrayOfValues}
									placeholder              = {p.allMessages[60]} // Mensaje: "Toque aquí" -> Esto es lo que se muestra en la parte externa cuando no se ha seleccionado ningún campo.		        
									placeholderSelectedItems = {s.numberOfItems + p.allMessages[61]} // Mensaje: " tipo(s)" -> Esto es lo que se muestra en la parte externa cuando ya se han seleccionado campos
								/>
							</View>
						</View>

					</ScrollView>
				</View>

				{s.isCore &&
					<View style = {genericStyles.smallRow}>
						{/*Mensaje: "El reservorio R está a :"*/}
						<Text style = {{textAlign: 'center', justifyContent: 'center', alignItems: 'center', color: 'blue'}}>{p.allMessages[62]}:{'\n'}	
							<Text style = {{color: 'black', fontSize: 11}}>
								{(s.R[0][0] == null) ? null : (s.R[0][1] + ' m      ' + s.R[1][1] + ' ft')}
							</Text>	
						</Text>
					</View>
				}

				{/*//Vista de los botones para darle Aceptar o Cancelar*/}
				<View style = {genericStyles.down_buttons}>

					<View style = {{paddingRight: 25}}>
						<ButtonNoIcon 
							raised
							title   = {p.allMessages[33]} // Mensaje: "Cancelar"
							color   = {DARK_GRAY_COLOR}
							onPress = {s.keyboardAvailable ? Keyboard.dismiss : (this.state.buttonsEnabled ? () => {this.refuseSettings()} : () => {})}
						/>
					</View>

					<View style = {{paddingLeft: 25}}>
						<ButtonWithIcon
							raised
							title   = {p.allMessages[59]}  /// Mensaje: "Aceptar"
							icon    = {{name: 'check'}}
							onPress = {s.keyboardAvailable ? Keyboard.dismiss: (this.state.buttonsEnabled ? () => {this.acceptSettings()} : () => {})}
						/>
					</View>

				</View>
			</View>
		);
	}
}

/// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages: ObjectForm_Texts[state.appPreferencesReducer.language],  
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

export default connect(mapStateToProps, mapDispatchToProps)(ObjectForm);