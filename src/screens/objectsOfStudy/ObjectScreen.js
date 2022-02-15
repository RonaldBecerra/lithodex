import React, { Component } from 'react';
import { Text, View, TextInput, Button as ButtonNoIcon, Picker, StyleSheet,
		 Modal, ScrollView, ActivityIndicator, Alert, Keyboard} from 'react-native';

import { Button as ButtonWithIcon } from 'react-native-elements'
import Icon from 'react-native-vector-icons/FontAwesome'

import { connect } from 'react-redux'
import { changeLoadView, changeGammaRay_Extract, 
	     changeStackScreenPropsFunction, changeStratumComponentPermission } from '../../redux/actions/popUpActions'
import { ObjectScreen_Texts } from '../../languages/screens/objectsOfStudy/ObjectScreen'

import ViewShot, {captureRef} from 'react-native-view-shot'
import * as ExpoMediaLibrary from 'expo-media-library'
import * as ExpoFileSystem   from 'expo-file-system'
import CameraRoll from "@react-native-community/cameraroll"
import * as Permissions from 'expo-permissions'

import * as D from '../../constants/Dimensions'
import { genericStyles, LIGHTGRAY_COLOR, DARK_GRAY_COLOR } from '../../constants/genericStyles'
import { OUTCROPS_DOCUMENT_ID, CORES_DOCUMENT_ID } from '../../constants/appConstants'

import * as Components from '../../components'
import * as Log        from '../../genericFunctions/logFunctions'
import * as Database   from '../../genericFunctions/databaseFunctions'
import * as auxiliarFunctions from '../../genericFunctions/otherFunctions'
import { createLayerListForShot, createGammaRayValuesProvisional, getStratumsIndexes,
         riseLayer, lowerLayer } from '../../genericFunctions/plotFunctions'

import _ from "lodash"

const UP_DOWN_BUTTONS_WIDTH = 80; // Espacio reservado para que se muestren los botones de subir o bajar un estrato de posición
const NUMBER_VERTICAL_GR_SEGMENTS = 7; // Número de divisiones verticales que tendrá la gráfica del gamma-ray, en caso de mostrarse

/* Cantidad de espacios de la regla vertical con información cargada.
   El resto de información se cargará a medida que el usuario navegue.
   Los estratos pueden requerir que se muestren más espacios que esta cantidad, pero nunca
   se mostrará más de esto en gamma-ray porque de lo contrario pueden ocurrir errores 

   Si estamos trabajando con afloramientos, donde no usamos la librería de gráficas, aumentamos este valor a 100
*/ 
var SPACES_TO_SHOW = 41.5; 

// Espacios que puede ocupar la regla vertical, tanto hacia arriba como hacia abajo, adicionales a la información cargada
const ADDITIONAL_SPACES_VERTICAL_RULE = 100; 


class ObjectScreen extends Component {	

	constructor(props) {
		super(props)
		this.keyboardDidShow = this.keyboardDidShow.bind(this)
		this.keyboardDidHide = this.keyboardDidHide.bind(this)

		if (! this.props.navigation.getParam('isCore')){
			SPACES_TO_SHOW = 100; // En los afloramientos se pueden mostrar más espacios porque no hay gráfica de gamma-ray
		}
			
		this.state = {
			// Información que se recupera del núcleo o afloramiento ya creado
			...this.props.navigation.state.params,

			// Información extra
			loading:              true,  // Indica si se está leyendo información de la base de datos PouchDB
			loadFunctionOpened:   true,  // Indica si se puede ingresar a la función loadObjectInfo
			stratumsAreAvailable: false, // Determina si al menos algún campo de los estratos está siendo mostrado, porque según eso mostraremos la regla vertical, botones de subir/bajar, etc.

			// Determina si el teclado está visible.
			keyboardAvailable: false,

			// Contiene la palabra "metros" o la palabra "pies", dependiendo de la unidad empleada, en el idioma correspondiente
			unitMessage: (this.props.navigation.getParam('unit') == 0) ? this.props.allMessages[35] : this.props.allMessages[36],

			// Aquí se almacenan las reglas
			verticalRule:           null, // Regla vertical que indica las alturas
			gammaRaySuperiorLabels: null, // Regla horizontal que indica los valores de gamma-ray

			// Variables para cuando el usuario necesita visualizar una altura específica inicial
			initLimitPreviewVisible: false, // Esta variable indica si esta abierto o no el modal que permite establecer una altura inicial de visión
			userStablishedInitLimit: false, // Indica si el usuario efectivamente acaba de establecer una altura específica
			
			// Variables para generar el ploteo del objeto
			imageFormat:            "jpg",        // Formato en el que sa guardará la imagen de captura
			takingShot:             false,        // Determina si en este momento se está tomando una captura del núcleo o afloramiento
			plotViewVisible:        false,        // Determina si está visible la vista provisional que se exporta como imagen
			takeShotPreviewVisible: false,        // Determina si está visible el modal en donde se establece dentro de qué límites se desea capturar el núcleo o afloramiento
			minCapturedHeight:      [null,null],  // Mínima altura del objeto que será capturada
			maxCapturedHeight:      [null,null],  // Máxima altura del objeto que será capturada. También se usa para indicar una altura inicial para mostrar en pantalla
			layerList_ForShot:      null,         // Copia del arreglo de estratos, que sólo se usa para hacer capturas
			gammaRayValues_ForShot: {},           // Copia de los valores de gamma-ray, que sólo se usa para hacer capturas
			verticalRule_ForShot:   null,         // Similar a "verticalRule", pero se crea provisionalmente sólo para las capturas de la vista
		};
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps, navigation }) => ({
		title: (navigation.state.params.isCore) ? ObjectScreen_Texts[screenProps.language][2] : ObjectScreen_Texts[screenProps.language][3],
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		},
		headerRight: (
			<View style = {{paddingRight: 5}}>
				<ButtonWithIcon
					onPress = {() => screenProps.stackFunction.ref()}
					icon    = {<Icon  name='eye'  size={25}  color='white'/>}
					type    = 'outline'
				/>
			</View>
		),
	});

	/// Para cargar la información del núcleo o afloramiento
	async loadObjectInfo(setRenderValues=true) {
		await this.props.localDB.get((this.state.isCore ? CORES_DOCUMENT_ID : OUTCROPS_DOCUMENT_ID))
			.then(async(document) => {

				// Información que se recupera del objeto ya creado
				this.setState({...document.objects[this.state._id]});

				// Si esta opción no es verdadera, luego tiene que establecerse el this.state.loading a false en la función que llame a ésta, porque ésta no lo hará
				if (setRenderValues){
					// --------------------------------------- Definición de variables comunes ------------------------------------------
					let s  = this.state;
					let aF = auxiliarFunctions;	

					let verticalRule = null; // Variable que almacena la regla vertical
					let minHeightForVerticalRule = null; // Altura mínima a la que llega la regla vertical
					let factor = D.SIZE_OF_UNIT / s.scale[0]; // Convierte una medida expresada en metros o pies en el equivalente que ocupa en la pantalla
					let additionalHeightVerticalRule = ADDITIONAL_SPACES_VERTICAL_RULE * s.scale[0]; // Esto sirve para que la regla vertical se ajuste a la gráfica

					// Necesitamos almacenar estas dos variables antes de hacer lo demás, porque se necesitarán para crear la regla vertical
					await this.setState({factor, additionalHeightVerticalRule})

					// Determina si se están mostrando los estratos, aunque sea alguno de sus campos
					let stratumsAreAvailable = (s.showInfo || s.showLithology || s.showStructure || s.showFossils || s.showPictures || s.showNotes);

					let numberLayers = s.layerList.length; // Cantidad de estratos registrados
					let minIndexStratums, maxIndexStratums; // Índices inferior y superior entre los estratos que estarán cargados (los que se muestran en un momento dado)
					let minHeightStratums_rendered, maxHeightStratums_rendered; // Alturas inferior y superior de entre los estratos que estarán cargados
					let absoluteMinHeightStratums, absoluteMaxHeightStratums; // Alturas inferior y superior entre todos los estratos, aunque no estén cargados
					
					// Alturas inferior y superior de los estratos que podrán mostrarse (todos en caso de que están disponibles, o ninguno en caso de que no lo estén)
					let potentialMinHeightStratums, potentialMaxHeightStratums; 

					absoluteMinHeightStratums = absoluteMaxHeightStratums = potentialMinHeightStratums = potentialMaxHeightStratums = minIndexStratums = 
					maxIndexStratums = minHeightStratums_rendered = maxHeightStratums_rendered = null;

					// Las siguientes dos variables almacenan tanto el valor numérico como el valor en cadena de caracteres, porque se le muestran al usuario
					// Se refieren a la máxima y mínima altura respectivamente del objeto de estudio que podría mostrarse en esta ventana, según los campos
					// seleccionados. Por ejemplo, si estamos en un núcleo y sólo estamos mostrando los estratos, no los rayos gamma, la altura mínima potencial podría ser
					// mayor que la real, porque puede que no hayamos registado estratos a tanta profundidad como rayos gamma.
					let potentialMaxHeight = [null, null];
					let potentialMinHeight = [null, null];

					// Altura máxima y mínima reales, respectivamente, del objeto de estudio. Sirven cuando estamos haciendo una captura de la gráfica para determinar
					// si estamos haciendo una toma completa del objeto de estudio o no.
					let absoluteMaxHeight = null;
					let absoluteMinHeight = null;

					// Cuando el objeto es un núcleo necesitamos variables adicionales a cuando es un afloramiento, debido al gamma-ray
					if (s.isCore){
						potentialMaxHeight = _.cloneDeep(s.baseHeight[s.unit]);
						absoluteMaxHeight  = potentialMaxHeight[0];

						// ----------------------- Información referente a la gráfica de gamma-ray -----------------------

						// Condición para determinar si hay una gráfica de gamma-ray registrada
						let thereIsGammaRay = s.gammaRayValues.hasOwnProperty('xValuesMeters') && (s.gammaRayValues.xValuesMeters.length > 0);

						// Condición para determinar si en este momento se está mostrando una gráfica gamma-ray o no
						let gammaRayIsRendered = s.showGammaRay && thereIsGammaRay;

						// Necesitamos las alturas mínima y máxima registradas en el gráfico de gamma-ray en total, independientemente de si dicho gráfico se está
						// mostrando o no, llamadas "absolute"; luego también las alturas máxima y mínima que podrán mostrarse, llamadas "potential",
						// e igualmente las que representan la parte de la gráfica que está actualmente cargada.
						let absoluteMinHeightGammaRay, absoluteMaxHeightGammaRay, potentialMinHeightGammaRay, potentialMaxHeightGammaRay, minHeightGammaRay_rendered, maxHeightGammaRay_rendered;
						absoluteMinHeightGammaRay = absoluteMaxHeightGammaRay = potentialMinHeightGammaRay = potentialMaxHeightGammaRay = minHeightGammaRay_rendered = maxHeightGammaRay_rendered = null;

						if (thereIsGammaRay){
							// Determinamos la altura mínima y máxima registradas en el gamma-ray en total
							let len_MinusOne = s.gammaRayValues.numberMeasurements-1;
							absoluteMinHeightGammaRay = (s.unit == 0) ? s.gammaRayValues.xValuesMeters[len_MinusOne] : s.gammaRayValues.xValuesFeet[len_MinusOne];
							absoluteMaxHeightGammaRay = (s.unit == 0) ? s.gammaRayValues.xValuesMeters[0] : s.gammaRayValues.xValuesFeet[0];
						}

						if (gammaRayIsRendered){
							potentialMinHeightGammaRay = absoluteMinHeightGammaRay;
							potentialMaxHeightGammaRay = absoluteMaxHeightGammaRay;

							// Creamos las etiquetas que indican valores de gamma-ray, que están sobre la gráfica
							this.createGammaRaySuperiorLabels();

							// Profundidad tope (superior) que se muestra en la gráfica
							let top = (s.unit==0) ? s.gammaRayValues.xValuesMeters[0] : s.gammaRayValues.xValuesFeet[0];
							
							// Aquí se determinan los límites del gamma-ray mostrado
							( {minHeightGammaRay_rendered, maxHeightGammaRay_rendered} = await this.getGammaRayValues_Extract(top) );
						}

						// ---------------------------- Información referente a los estratos -------------------------
						if (numberLayers != 0){
							absoluteMinHeightStratums = s.layerList[numberLayers-1].lowerLimit[s.unit][0];
							absoluteMaxHeightStratums = s.layerList[0].upperLimit[s.unit][0];

							if (stratumsAreAvailable){
								potentialMinHeightStratums = absoluteMinHeightStratums;
								potentialMaxHeightStratums = absoluteMaxHeightStratums;

								let bottom = gammaRayIsRendered ? minHeightGammaRay_rendered : potentialMaxHeight[0]- SPACES_TO_SHOW*s.scale[0];
								( {minIndexStratums, maxIndexStratums, minHeightStratums_rendered, maxHeightStratums_rendered} = await this.getLayerList_Limits(bottom, potentialMaxHeight[0]) );
							}
						}
						// Aquí determinamos la altura mínima registrada en el núcleo, independientemente de si es alcanzable en este momento o no
						absoluteMinHeight = aF.repairNumber( aF.min(absoluteMinHeightStratums, absoluteMinHeightGammaRay), 20 )[0];

						// ----------------- Aquí determinamos las alturas límites que podrán mostrarse, y el extremo inferior de la regla vertical -----------------------
						potentialMinHeight = aF.repairNumber( aF.min(potentialMinHeightStratums, potentialMinHeightGammaRay), 20 );
						if (potentialMinHeight[0] == null){
							potentialMinHeight = _.cloneDeep(potentialMaxHeight);
						}
						minHeightForVerticalRule = aF.max( aF.min(minHeightStratums_rendered, minHeightGammaRay_rendered)-additionalHeightVerticalRule,  potentialMinHeight[0]);
						verticalRule = this.createVerticalRule(minHeightForVerticalRule, absoluteMaxHeight, 0, (minHeightForVerticalRule - potentialMinHeight[0]));

						// Aprovechamos de salvar aquí estas variables, ya que no se hará en el caso de afloramientos
						this.setState({gammaRayIsRendered, absoluteMinHeightGammaRay, absoluteMaxHeightGammaRay, potentialMinHeightGammaRay, potentialMaxHeightGammaRay, minHeightGammaRay_rendered, maxHeightGammaRay_rendered})	
					} 
					else{ // Caso en que estamos trabajando con afloramientos
						potentialMinHeight = _.cloneDeep(s.baseHeight[s.unit]);
						potentialMaxHeight = (numberLayers > 0) ? (_.cloneDeep(s.layerList[0].upperLimit[s.unit])) : _.cloneDeep(potentialMinHeight);
						
						if ((numberLayers != 0) && (stratumsAreAvailable)){
							absoluteMinHeight = potentialMinHeight[0];
							absoluteMaxHeight = potentialMaxHeight[0];

							let bottom = absoluteMaxHeight - SPACES_TO_SHOW*s.scale[0];
							( {minIndexStratums, maxIndexStratums, minHeightStratums_rendered, maxHeightStratums_rendered} = await this.getLayerList_Limits(bottom, absoluteMaxHeight) );

							minHeightForVerticalRule = aF.max( minHeightStratums_rendered-additionalHeightVerticalRule, potentialMinHeight[0]);
							verticalRule = this.createVerticalRule(minHeightForVerticalRule, absoluteMaxHeight, 0, (minHeightForVerticalRule - absoluteMinHeight));	
						} 			           
					}
					// Aquí almacenamos las variables que deben estar presentes independientemente de si e trata de un núcleo o afloramiento
					this.setState({
						verticalRule,
						absoluteMaxHeight, absoluteMinHeight, potentialMaxHeight, potentialMinHeight,

						stratumsAreAvailable, numberLayers, minIndexStratums, maxIndexStratums, minHeightStratums_rendered, maxHeightStratums_rendered,
						absoluteMinHeightStratums, absoluteMaxHeightStratums, potentialMinHeightStratums, potentialMaxHeightStratums,

						// Estas dos variables sirven para determinar si se permite o no cargar más datos al desplazarse por la pantalla verticalmente
						inmediateBottomLoadEnabled: true,  // Permite cargar datos de mayor profundidad que los que ya estaban cargados, contiguos a éstos
						inmediateTopLoadEnabled:    false, // Permite cargar datos de menor profundidad que los que ya estaban cargados, contiguos a éstos

						unitMessage: (s.unit == 0) ? this.props.allMessages[35] : this.props.allMessages[36],
						loading: false,

					});
				}
				await this.props.dispatchChangeLoadView(false);
				await this.props.dispatchEnteringPermission(true);
				// Esto hace que el botón que está en la parte derecha de la cabecera pueda abrir la vista para comenzar viendo la gráfica desde cierta altura
				this.props.dispatchStackScreenPropsFunction(this.openInitLimitPreview);
				
				this.setState({loadFunctionOpened: true});
			})
			.catch(function(error){
				console.error(error.toString());
			})
	}

	componentDidMount(){
		// Aquí inicializamos los escuchas que determinan si el teclado se está mostrando o no
		this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow);
		this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide);

		Log.log_action({entry_code: 10, user_id: this.props.user_id, isCore: this.state.isCore, object_id: this.state._id});
	}

	// Quitamos los escuchas del teclado cuando salimos de esta ventana
	componentWillUnmount() {
		this.keyboardDidShowListener.remove();
		this.keyboardDidHideListener.remove();
		// Reseteamos valores de la Tienda Redux
		this.props.dispatchGammaRay_Extract({});
		this.props.dispatchChangeLoadView(false);
		this.props.dispatchStackScreenPropsFunction(() => {});
	}

	// Función que determina si se puede navegar a otra vista
	canNavigate(){
		return (!(this.state.plotViewVisible || this.state.takeShotPreviewVisible)) && this.props.enteringComponentEnabled;
	}

	// Caso en que el teclado se está mostrando
	keyboardDidShow() {
		this.setState({keyboardAvailable: true});
	}

	// Caso en que el teclado se ocultó
	keyboardDidHide() {
		this.setState({keyboardAvailable: false});
	}

	// Función para hacer visible el modal en el que se puede establecer una altura inicial que visualizar. Esto sirve cuando hay demasiados cargados
	// en esta vista, y por consiguiente habría que deslizar mucho la pantalla para alcanzar cierto objetivo
	openInitLimitPreview = () => {
		if (this.props.enteringComponentEnabled){
			this.props.dispatchEnteringPermission(false);
			this.setState({initLimitPreviewVisible: true});
		}
	}

	// Con esto se cierra el modal indicado arriba
	closeInitLimitPreview = () => {
		this.props.dispatchEnteringPermission(true);
		this.setState({initLimitPreviewVisible: false, maxCapturedHeight: [null,null]});
	}

	// Aquí hacemos que la gráfica se dirija a donde está la altura indicada (o rechazamos dicha altura porque no está entre los límites).
	stablishInitLimit = () => {
		let s = this.state;
		let p = this.props;

		if (s.maxCapturedHeight[0] == null){
			// Alerta: "Debe llenar todos los campos"
			Alert.alert(p.allMessages[4], p.allMessages[5]);
		}
		else if ((s.maxCapturedHeight[0] > s.potentialMaxHeight[0]) || (s.maxCapturedHeight[0] < s.potentialMinHeight[0])){
			// Alerta: "La altura debe estar entre los límites indicados"
			Alert.alert(p.allMessages[4], p.allMessages[6]);
		}
		else {
			// Hay que establecer la condición de que el usuario especificó una altura, ya que en la función que determina si se deben cargar más datos
			// (determine_LimitExceeded) ello se toma en cuenta
			this.setState({userStablishedInitLimit: true},
				() => {
					// Lo bueno es que la función "scrollTo" activa la condición "onScroll" del ScrollView vertical de la gráfica
					this.refs.verticalScrollView.scrollTo({y: (s.potentialMaxHeight[0]-s.maxCapturedHeight[0])*s.factor, animated: false});
					this.closeInitLimitPreview();
				}
			);
		}
	}

	// Función para hacer visible el modal en el que se establecen los límites de captura. Pero antes de abrirlo, por defecto
	// les asigna a esos límites los mismos registrados en el objeto de estudio, a menos que se trate de un núcleo con gamma-ray mostrada.
	// En ese caso asigna la mayor captura posible tal que no se generen errores
	openTakeShotPreview = () => {
		if (this.props.enteringComponentEnabled) {
			let aF = auxiliarFunctions;
			let s = this.state;
			this.props.dispatchEnteringPermission(false);

			const maxCapturedHeight = _.cloneDeep(s.potentialMaxHeight);
			let minCapturedHeight;

			if (s.isCore && s.gammaRayIsRendered){
				minCapturedHeight = aF.repairNumber( aF.max(s.potentialMinHeight[0], s.potentialMaxHeight[0] - SPACES_TO_SHOW * s.scale[0]), 20 );
			} 
			else {
				minCapturedHeight = _.cloneDeep(this.state.potentialMinHeight);
			}
			this.setState({maxCapturedHeight, minCapturedHeight, takeShotPreviewVisible: true});
		}
	} 

	// Para ocultar el formulario de cuando se está tomando una captura
	finishTakingShot = () => {
		this.props.dispatchEnteringPermission(true);
		this.setState({
			takingShot: false,
			plotViewVisible: false, takeShotPreviewVisible: false,
			verticalRule_ForShot: null, layerList_ForShot: null,
			gammaRayValues_ForShot: {},
			maxCapturedHeight: [null,null], minCapturedHeight: [null,null], 
		});
	}

	// Tomar captura de columna estratigráfica y/o gráficos de gamma-ray
	takeShot = async() => {
		let s = this.state;
		let p = this.props;

		// Procedimiento auxiliar que es invocado cuando ya se han terminado de establecer los parámetros necesarios
		let auxiliarTakeShot = (p) => {
			this.setState({loading: false},
				() => {
					this.refs.viewShot.capture()
						.then(async(uri) => {
							const { status } = await Permissions.askAsync(Permissions.CAMERA_ROLL);
							if (status == 'granted'){
								const asset = await ExpoMediaLibrary.createAssetAsync(uri);
								ExpoFileSystem.deleteAsync(uri);
								// Alerta: "La captura fue exportada exitosamente"
								Alert.alert(p.allMessages[4], p.allMessages[7]);
								this.finishTakingShot();
							}
							else {
								// Alerta: "No tiene permiso para salvar en la galería"
								Alert.alert(p.allMessages[4], p.allMessages[8]);
								this.setState({takingShot: false});
							}
						}).catch(function (error){
							console.error(error.toString());
						})
				}
			)
		}

		if ((s.maxCapturedHeight[0] == null) || (s.minCapturedHeight[0] == null)){
			// Alerta: "Debe llenar todos los campos"
			Alert.alert(p.allMessages[4], p.allMessages[5]);		
		}
		else if (s.maxCapturedHeight[0] > s.potentialMaxHeight[0]){
			// Alerta: "Límite superior excedido"
			Alert.alert(p.allMessages[4], p.allMessages[9]);
		}
		else if (s.minCapturedHeight[0] < s.potentialMinHeight[0]){
			// Alerta: "Límite inferior excedido"
			Alert.alert(p.allMessages[4], p.allMessages[10]);
		}
		else if (s.maxCapturedHeight[0] <= s.minCapturedHeight[0]){
			// Alerta: "La cota superior debe ser mayor que la cota inferior"
			Alert.alert(p.allMessages[4], p.allMessages[11]);
		}
		else {
			this.setState({loading: true, takingShot: true, plotViewVisible: true, takeShotPreviewVisible: false}); 

			/* Esperamos a cargar nuevamente los datos, porque recuerda que los cambios en los campos de los estratos (Litología, Estructura,...)
			   se reflejan en los componentes pero todavía no están en las variables de estado de esta vista */
			await this.loadObjectInfo(false);

			// Determina si los límites de captura son los mismos del objeto completo
			const limitsAreTheSame = (s.minCapturedHeight[0] == s.potentialMinHeight[0]) && (s.maxCapturedHeight[0] == s.potentialMaxHeight[0]);

			/* Nota que varias veces hubo que colocar "this.state" en lugar de sólo "s" porque puede que los valores guardados en la variable
			   "s" todavía no se haya actualizado después de la lectura a la base de datos. Por lo que he notado, lo que está en "s" sí se actualiza
			   cuando se modifica el "this.state", pero tarda más en hacerlo.
			 */
			if (limitsAreTheSame){
				let object = await {
					verticalRule_ForShot: s.verticalRule,
					layerList_ForShot:    JSON.parse(JSON.stringify(this.state.layerList)), // Esto hace que se cree una copia del layerList, y no referenciemos al original
				};

				if (s.gammaRayIsRendered){
					object.gammaRayValues_ForShot = await JSON.parse(JSON.stringify(s.gammaRayValues));
				}
				this.setState(object, () => {auxiliarTakeShot(p)});
			} else {
				let object = await {
					verticalRule_ForShot: this.createVerticalRule(s.minCapturedHeight[0], s.maxCapturedHeight[0]),
					layerList_ForShot:    createLayerListForShot(s.minCapturedHeight[0], s.maxCapturedHeight[0], JSON.parse(JSON.stringify(this.state.layerList)), s.unit, D.SIZE_OF_UNIT/s.scale[0]),
				};

				if (s.gammaRayIsRendered){
					object.gammaRayValues_ForShot = await createGammaRayValuesProvisional(s.minCapturedHeight[0], s.maxCapturedHeight[0], JSON.parse(JSON.stringify(s.gammaRayValues)), s.unit);
				}
				this.setState(object, () => {auxiliarTakeShot(p)});
			}	
		}
	}

	// Procedimiento para cambiar algún valor numérico
	onChangeNumericValue = async(variableName, text) => {
		let result;
		let object = {}

		if (auxiliarFunctions.isValidDecimalNumber(text)){
			result = (text != "-") ? [parseFloat(text), text] : [null, "-"];
		} else {
			if ((text == " ") || (text == "")){} 
			else {
				// Alerta: "El valor ingresado no es válido"
				Alert.alert(this.props.allMessages[4], this.props.allMessages[22]);
			}
			/* Este this.setState con el await se coloca porque si el primer carácter del texto es inválido, como si por ejemplo comienza con ")", entonces
			   el this.setState de abajo no es capaz de limpiar el cuadro de texto */
			object[variableName] = [0, "0"];
			await this.setState(object); 
			result = [null, null];
		}
		object[variableName] = result;
		this.setState(object);
	}

	// Para ir a la ventana del formulario del núcleo o afloramiento
	editObjectInfo = async() => {
		if (this.canNavigate()){
			this.props.dispatchEnteringPermission(false);
			/* Es necesario volver a cargar los datos, porque si se modificó algún campo de algún módulo, como por ejemplo
			   una litología, eso se habrá guardado en la base de datos pero no en el estado de esta vista, así que si pasamos
			   como payload dicho estado, será información desactualizada, y si el usuario le da a "Aceptar" en el ObjectForm,
			   lo que se guarde será en base a lo desactualizado*/
			await this.loadObjectInfo(false); 

			this.props.navigation.navigate({ key: 'ObjectForm', routeName: 'ObjectForm', params: {...this.state, returnToObjectScreen: true}});
		}
	}

	// Para ir al formulario donde se agrega un nuevo estrato
	addNewStratum = async() => {
		if (this.canNavigate()){
			this.props.dispatchEnteringPermission(false);
			/* Es necesario volver a cargar los datos, porque si se modificó algún campo de algún módulo, como por ejemplo
			   una litología, eso se habrá guardado en la base de datos pero no en el estado de esta vista, así que como estamos
			   pasando como "payload" el layerList actual, se trabjará con el dato desactualizado */
			await this.loadObjectInfo(false); 
			let {_id, unit, layerList, scale, baseHeight, isCore} = this.state;
			let payload = {_id, unit, layerList, scale, baseHeight, isCore};
			
			this.props.navigation.navigate({ key: 'ObjectStratumForm', routeName: 'ObjectStratumForm', params: payload});
		}
	}

	/* Función para actualizar los límites de los estratos cargados y también los límites de la regla vertical, lo cual es necesario
	   una vez que se elimina un estrato, o cuando dos estratos cambian de posición */
	update_StratumsRendered_VerticalRule = async() =>{
		let s = this.state;
		let verticalRule;
		let {minIndexStratums, maxIndexStratums, minHeightStratums_rendered, maxHeightStratums_rendered} = this.state;

		( {minIndexStratums, maxIndexStratums, minHeightStratums_rendered, maxHeightStratums_rendered} 
			= await this.getLayerList_Limits(minHeightStratums_rendered, maxHeightStratums_rendered) );

		if (s.isCore){
			let {minHeightGammaRay_rendered, maxHeightGammaRay_rendered} = this.state;
			let minHeightForVerticalRule = auxiliarFunctions.min(minHeightGammaRay_rendered, minHeightStratums_rendered);
			let maxHeightForVerticalRule = auxiliarFunctions.max(maxHeightGammaRay_rendered, maxHeightStratums_rendered);

			verticalRule = this.createVerticalRule(minHeightForVerticalRule, maxHeightForVerticalRule, 
				(s.potentialMaxHeight[0] - maxHeightForVerticalRule), 
				(minHeightForVerticalRule - s.potentialMinHeight[0])
			);
		}
		else {
			verticalRule = this.createVerticalRule(minHeightStratums_rendered, maxHeightStratums_rendered,
				(s.potentialMaxHeight[0] - maxHeightStratums_rendered),
				(minHeightStratums_rendered - s.potentialMinHeight[0])
			);
		}
		this.setState({verticalRule, minIndexStratums, maxIndexStratums, minHeightStratums_rendered, maxHeightStratums_rendered});
	}

	// Función para obtener tanto los índices de los estratos superior e inferior que se cargarán provisionalmente mientras estemos
	// deslizando la pantalla, así como también la altura máxima y mínima de entre todos esos estratos mostrados
	getLayerList_Limits = async(bottom, top) => {
		let s = this.state;
		let minHeightStratums_rendered, maxHeightStratums_rendered;
		minHeightStratums_rendered = maxHeightStratums_rendered = null;

		let indexesStratums = await getStratumsIndexes(bottom, top, JSON.parse(JSON.stringify(s.layerList)), s.unit, D.SIZE_OF_UNIT/s.scale[0]);

		// Nótese que como los estratos están ordenados de modo decreciente en cuanto a altura, entonces "minIndexStratums" será mayor
		// que "maxIndexStratums"
		let minIndexStratums = indexesStratums[0]; // Índice del estrato tope inferiormente que se mostrará
		let maxIndexStratums = indexesStratums[1]; // Índice del estrato tope superiormente que se mostrará

		if ((minIndexStratums != null) && (maxIndexStratums != null)){
			minHeightStratums_rendered = s.layerList[minIndexStratums].lowerLimit[s.unit][0]; 
			maxHeightStratums_rendered = s.layerList[maxIndexStratums].upperLimit[s.unit][0];
		}
		return {minIndexStratums, maxIndexStratums, minHeightStratums_rendered, maxHeightStratums_rendered};
	}

	// Eliminar el estrato inferior en el caso de los núcleos, y superior en el caso de los afloramientos
	removeLastLayer = () => {
		let s = this.state;
		let p = this.props;

		// Procedimiento auxiliar que se invoca cuando se confirma que se quiere eliminar el estrato límite
		let remove = (s,p) => {
			let keyToRemove;
			let array = s.layerList;
			s.numberLayers -= 1;

			let absoluteMinHeightStratums, absoluteMaxHeightStratums, potentialMinHeightStratums, potentialMaxHeightStratums;
			absoluteMinHeightStratums = absoluteMaxHeightStratums = potentialMinHeightStratums = potentialMaxHeightStratums = null;

			if (s.isCore){
				keyToRemove = array[array.length-1].key;
				array.pop();
				
				if (s.numberLayers != 0){
					absoluteMinHeightStratums = potentialMinHeightStratums = s.layerList[s.numberLayers-1].lowerLimit[s.unit][0];
				} else {
					absoluteMinHeightStratums = potentialMinHeightStratums = s.baseHeight[s.unit][0];
				}
				
				// La altura mínima en total (estratos/gamma-ray) pudo haber cambiado. La máxima no la tocamos porque los estratos siempre comienzan
				// en el tope del núcleo. No pueden empezar más abajo, a diferencia de los rayos-gamma.
				let potentialMinHeight = auxiliarFunctions.repairNumber(auxiliarFunctions.min(potentialMinHeightStratums, s.potentialMinHeightGammaRay),20);
				let absoluteMinHeight = auxiliarFunctions.repairNumber(auxiliarFunctions.min(absoluteMinHeightStratums, s.absoluteMinHeightGammaRay),20)[0];

				this.setState({layerList: array, absoluteMinHeight, potentialMinHeight, potentialMinHeightStratums, absoluteMinHeightStratums}, 
					() => {this.update_StratumsRendered_VerticalRule()});
			}
			else {
				keyToRemove = array[0].key;
				array.shift();

				potentialMaxHeight = (s.numberLayers != 0) ? _.cloneDeep(s.layerList[0].upperLimit[s.unit]) : _.cloneDeep(s.potentialMinHeight);
				absoluteMaxHeight = absoluteMaxHeightStratums = potentialMaxHeightStratums = potentialMaxHeight[0];

				this.setState({layerList: array, absoluteMaxHeight, absoluteMaxHeightStratums, potentialMaxHeightStratums, potentialMaxHeight}, 
					() => {this.update_StratumsRendered_VerticalRule()});
			}

			// Los argumentos son: 1) user_id; 2) object_id; 3) layerList; 4) isCore; 5) localDB; 6) stratum_key=keyToRemove; 7) kind = 2
			Database.saveLayerList(p.user_id, s._id, array, s.isCore, p.localDB, keyToRemove, 2);
		}

		if ((s.numberLayers > 0) && (s.stratumsAreAvailable)){
			// Alerta:
			// Mensaje 1: "¿Seguro de que desea eliminar el estrato inferior?"
			// Mensaje 2: "¿Seguro de que desea eliminar el estrato superior?"
			Alert.alert(p.allMessages[4], (s.isCore ? p.allMessages[12] : p.allMessages[13]),
				[
					// Mensaje: "Sí"
					{text: p.allMessages[14], onPress: () => remove(s,p)},
					// Mensaje: "No"
					{text: p.allMessages[15]},
				] 
			)	
		}
	}

	// Sirve para subir al estrato de lugar una posición
	riseLayerPosition(layer,i){
		if (i > 0){
			const li = riseLayer(this.state.layerList, layer, i);
			this.setState({layerList: li}, () => {this.update_StratumsRendered_VerticalRule()});
			Database.saveLayerList(this.props.user_id,this.state._id, li, this.state.isCore, this.props.localDB);
		}
	}

	// Sirve para bajar al estrato de lugar una posición
	lowerLayerPosition(layer,i){
		if (i < this.state.numberLayers - 1){
			const li = lowerLayer(this.state.layerList, layer, i);
			this.setState({layerList: li}, () => {this.update_StratumsRendered_VerticalRule()});
			Database.saveLayerList(this.props.user_id,this.state._id, li, this.state.isCore, this.props.localDB);	
		}
	}

	// Mostrar la regla lateral izquierda con las medidas según la escala
	createVerticalRule(potentialMinHeight, potentialMaxHeight, superiorSpace=null, inferiorSpace=null) {
		let s = this.state;
		var totalHeight = 0; // Altura total que debe ocupar la regla

		if ((potentialMinHeight != null) && (potentialMaxHeight != null)){
			totalHeight = (potentialMaxHeight - potentialMinHeight) * s.factor;
		}
		const added = s.showCarbonatesRule ? 0 : (s.isCore ? 5 : 0);

		// Estos espacios sirven para que no se genere toda la regla, gastando memoria, sino que sólo haya una parte visible.
		superiorSpace = ((superiorSpace==null) ? 0 : (superiorSpace * s.factor));
		inferiorSpace = ((inferiorSpace==null) ? added : (inferiorSpace * s.factor + added));

		const integer = parseInt(totalHeight / 65);
		const numberOfDivisions = (totalHeight != 0) ? (integer+1) : 0;

		let lastIndex, difference;

		var array = []; // Creamos un arreglo cuyos elementos son los valores que mostrará la regla
		let ruleView; // Aquí almacenaremos la parte que cambia dependiendo de si se trata de un afloramiento o un núcleo
		

		// Caso en que el objeto de estudio es un núcleo
		if (s.isCore){
			for (i = 0; i < numberOfDivisions; i++){
				array.push({value: parseFloat((-1) * s.scale[0] * parseFloat(i) + potentialMaxHeight).toFixed(2)})
			}
			lastIndex = array.length - 1;

			ruleView = (
				<View>
					{array.map((item,i) => (
						<View style={{flexDirection: 'row', justifyContent: 'flex-end'}}  key={i}>
							<View style = {{height: (item.value != potentialMaxHeight) ? 45 : 10, paddingRight: 5, flexDirection: 'column', justifyContent: 'flex-start'}}>
								<Text style = {{fontSize: 12}}>{item.value}{(s.unit == 0) ? "m" : "ft"}</Text>
							</View>
							<View style = {{borderTopColor: 'black', borderTopWidth: 1, flexDirection: 'row', width: 10, paddingTop: (i==lastIndex) ? 15 : D.SIZE_OF_UNIT-1}}/>
						</View>
					))}
				</View>
			)
		} else {
			// Caso en que el objeto de estudio es un afloramiento
			difference = totalHeight - integer * 65; 

			// Como los espacios se cuentan desde la parte inferior, guardamos los valores en el arreglo en orden inverso
			for (i = 0; i < numberOfDivisions; i++){
				array.unshift({value: parseFloat(s.scale[0] * parseFloat(i) + potentialMinHeight).toFixed(2)})
			}
			lastIndex = array.length - 1;

			ruleView = (
				<View>
					{(difference > 0) && // Esto porque los espacios se empiezan a contar desde la parte superior, no la inferior, así que si hay un sobrante, el cero no estará en el límite inferior.
						<View style = {{paddingTop: difference}}/>
					}

					{array.map((item,i) => (
						<View style={{flexDirection: 'row', justifyContent: 'flex-end'}}  key={i}>
							<View style = {{height: (item.value != potentialMinHeight) ? 45 : 10, paddingRight: 5, flexDirection: 'column', justifyContent: 'flex-start'}}>
								<Text style = {{fontSize: 12}}>{item.value}{(s.unit == 0) ? "m" : "ft"}</Text>
							</View>
							<View style = {{borderTopColor: 'black', borderTopWidth: 1, flexDirection: 'row', width: 10, paddingTop: (i==lastIndex) ? 25 : D.SIZE_OF_UNIT-1}}/>
						</View>
					))}

				</View>
			)
		}

		return (	
			<View style = {{flexDirection: 'column'}}>
				{/* Como no siempre cargamos la gráfica completa sino sólo lo visible, entonces también podemos omitir la parte de la regla que no está visible*/}
				<View style = {{height: superiorSpace}}/>
				<View style = {{flexDirection: 'row'}}>
					{/*Parte de la regla que cambia dependiendo de si es un afloramiento o un núcleo*/}
					{ruleView}
					<View style = {{height: totalHeight + 1, flexDirection: 'column', borderWidth: 0.5, borderColor: 'black'}}/>
				</View>

				{/*// Como no siempre cargamos la gráfica completa sino sólo lo visible, entonces también podemos omitir la parte de la regla que no está visible*/}
				<View style = {{height: inferiorSpace}}/>
			</View>
		);
	}


	/// Función para crear las etiquetas superiores de la gráfica del gamma-ray, que representan precisamente valores de rayos-gamma
	createGammaRaySuperiorLabels(){
		let s = this.state;

		if (s.gammaRayValues && s.gammaRayValues.hasOwnProperty('yValues')){
			// Separación entre cada medición de gamma-ray. Esta fórmula es la misma que se utiliza en el archivo abstract-chart.js de
			// la librería "react-native-chart-kit" para establecer la separación entre medicíones, sólo que escrita de otra forma
			const separation = 3 * (D.GAMMA_RAY_WIDTH+40) / (4 * NUMBER_VERTICAL_GR_SEGMENTS); 
			var array = []; // Valores que se mostrarán encima de la gráfica

			const scaler = (s.gammaRayValues.maxYValue - s.gammaRayValues.minYValue) || 1;
			const div = scaler/NUMBER_VERTICAL_GR_SEGMENTS;

			for (i = 0; i < NUMBER_VERTICAL_GR_SEGMENTS+1; i++){
				array.push( (div * i + s.gammaRayValues.minYValue).toFixed(2));
			}

			const returnedView = (
				<View style = {{flexDirection: 'column', height: 40}}>
					<View style = {{flexDirection: 'row'}}>
						{array.map((item,i) => (
							<View style={{flexDirection: 'column', justifyContent: 'flex-end'}}  key={i}>
								{/*Texto de la regla*/}
								<View 
									style = {{
										width:          separation, 
										height:         40,
										flexDirection:  'row', 
										justifyContent: 'flex-start', 
										alignItems:     'flex-start',
										paddingTop:     12,
									}}
								>
									<Text style = {{fontSize: 10, opacity: 0.8, transform: [{ rotate: "90deg" }]}}>
										{item}
									</Text>
								</View>
							</View>
						))}
					</View>
				</View>
			);

			this.setState({gammaRaySuperiorLabels: returnedView});
		}
	}

	/// Función para obtener el extracto de valores de gamma-ray que se mostrárá, porque recuérdese que no
	//  siempre podremos mostrar todo el gráfico debido al límite de memoria posible
	getGammaRayValues_Extract = async(topHeight) => {
		let s = this.state;

		/* Aquí construimos el objeto de valores gamma-ray que se mostrará. Nótese que el límite inferior tiene que estar a una altura SPACES_TO_SHOW*s.scale[0]
		   menos que la altura superior. Esta diferencia fue probada empíricamente con los dos archivos de gamma-ray provistos por el profesor Baena */
		await this.props.dispatchGammaRay_Extract(
			createGammaRayValuesProvisional(topHeight - SPACES_TO_SHOW*s.scale[0], topHeight, JSON.parse(JSON.stringify(s.gammaRayValues)), s.unit)
		);
		let minHeightGammaRay_rendered, maxHeightGammaRay_rendered;
		minHeightGammaRay_rendered = maxHeightGammaRay_rendered = null;

		if (this.props.gammaRayValues_Extract.numberMeasurements > 0){
			let len_MinusOne = this.props.gammaRayValues_Extract.numberMeasurements - 1;
			minHeightGammaRay_rendered = (s.unit == 0) ? this.props.gammaRayValues_Extract.xValuesMeters[len_MinusOne] : this.props.gammaRayValues_Extract.xValuesFeet[len_MinusOne];
			maxHeightGammaRay_rendered = (s.unit == 0) ? this.props.gammaRayValues_Extract.xValuesMeters[0] : this.props.gammaRayValues_Extract.xValuesFeet[0];
		}

		return {minHeightGammaRay_rendered, maxHeightGammaRay_rendered};
	}

	// Encabezado del núcleo o afloramiento, que aparece en la parte superior, donde se muestra su nombre,
 	// la escala, los botones para agregar o eliminar un nuevo estrato, etc.
	objectInformationHeader(takingShot = false){
		let s = this.state;
		let p = this.props;

		let completeShot = false; // Determina si una captura va a ser completa (altura total) o no

		if (takingShot){ 
			let minLimitMatches = (this.state.minCapturedHeight[0] == s.absoluteMinHeight);
			let maxLimitMatches = (this.state.maxCapturedHeight[0] == s.absoluteMaxHeight);
			completeShot = minLimitMatches && maxLimitMatches;
		}

		return(
			<View>
				{/*Caso en que no estamos tomando una captura de la vista*/}
				{!takingShot &&
					<View style = {localStyles.objectInfo_header}>
						{/*Parte izquierda superior de la pantalla, que muestra el nombre del objeto de estudio, su altura base y la escala empleada*/}
						<View style = {localStyles.objectInfo_header_text}>
							<Text style = {{fontWeight: 'bold', fontSize: 12}}>{s.name}</Text>

							{/*//Mensaje: "Escala" */}
							<Text style = {{fontSize: 12}}>{p.allMessages[16]}: 1:{s.scale[0]}</Text> 
							{/*//Mensaje: "Altura base" */}
							<Text style = {{fontSize: 12}}>{p.allMessages[17]}: {(s.unit == 0) ? s.baseHeight[0][0] + " m" : s.baseHeight[1][0] + " ft"}</Text> 
						</View>

						{s.stratumsAreAvailable && // Botón para agregar un nuevo estrato
							<View style = {{flex:0.3, padding:10, width:10}}>
								<ButtonNoIcon title = "+" onPress = {() => this.addNewStratum()}/>
							</View>
						}
						{s.stratumsAreAvailable && // Botón para eliminar el estrato que esté en la parte superior
							<View style = {{flex:0.3, padding:10, width:10}}> 
								<ButtonNoIcon title = "-" onPress = {this.removeLastLayer} color = 'red'/>
							</View>
						}
					</View>
				}

				{/*Caso en que estamos tomando una captura de la vista*/}
				{takingShot &&
					<View style = {{...localStyles.objectInfo_header, height: 75, paddingTop: 15}}>
						{/*Parte superior, que muestra el nombre del objeto; indica si se tomó completo o 
						   sólo un extracto; dice su localización y su escala*/}
						<View style = {{...localStyles.objectInfo_header_text, alignItems: 'center'}}>
							{/*Mensajes: "Núcleo"  "Afloramiento" */}
							<Text style = {{fontWeight: 'bold', fontSize: 25}}>{(s.isCore) ? p.allMessages[2] : p.allMessages[3]} {s.name}</Text>

							{/*//Mensaje: "Localización"*/}
							{(s.locationInWords != null) && (s.locationInWords != "") && (s.locationInWords != " ") &&
								<Text style = {{fontSize: 15}}>{p.allMessages[18]}: {s.locationInWords}</Text>
							}

							{/*//En esta parte se indica si la toma es completa (todo lo que se ha agregado) o es un extracto*/}
							<View style = {{alignItems: 'center'}}>
								{/*Mensajes: "Toma completa" "Extracto"*/}
								<Text style = {{fontSize: 15}}>({completeShot ? p.allMessages[19] : p.allMessages[20]})</Text>
							</View>

							{/*Mensaje: "Escala" */}
							<Text style = {{fontSize: 15}}>{p.allMessages[16]}: 1:{s.scale[0]}</Text> 
						</View>
					</View>
				}
			</View>
		)
	}

	// Encabezado de las gráficas, que incluye la columna estratigráfica y quizás la gráfica de rayos gamma
	graphicsColumnHeader(space, takingShot=false){
		let s = this.state;
		let p = this.props;

		var conditionGammaRay = false; // Determina si se mostrarán desde esta vista las etiquetas con los valores de gamma-ray

		if (s.showGammaRay){
			var gammaRayValues = (takingShot) ? this.state.gammaRayValues_ForShot : s.gammaRayValues ;
		}

		// Vista auxiliar que se utiliza varias veces
		function header_aux(headerWidth, message){
			return(
				<View style = {{...localStyles.field_section, width: headerWidth}}>
					<Text style = {{fontWeight: 'bold'}}>{message}</Text>   
				</View>
			)
		}
				
		// Tenemos que poner este condicional, porque se tarda un poco en asignar el objeto a la variable
		if ((!s.isCore) || (!s.showGammaRay) || (s.minHeightGammaRay==null) || gammaRayValues){
			if (s.showGammaRay){
				conditionGammaRay = (gammaRayValues.hasOwnProperty('xValuesMeters') && (gammaRayValues.xValuesMeters.length > 0));
				if (takingShot && conditionGammaRay){
					const maxHeightGammaRay = (s.unit == 0) ? gammaRayValues.xValuesMeters[0] : gammaRayValues.xValuesFeet[0];

					// Si la diferencia entre la máxima altura a mostrar del núcleo y el máximo valor leído del gamma-ray,
					// escalándola según el tamaño de cada unidad y la escala actual, es mayor que 40, no mostraremos 
					// aquí las eqtiquetas superiores sino que lo haremos desde el código donde se crea la gráfica
					if ((this.state.maxCapturedHeight[0] - maxHeightGammaRay) * s.factor > 40){
						conditionGammaRay = false;
					}
				}
			}
			return(
				<View>
					{/*En esta vista está la cabecera con los títulos de los campos: "Litología", "Estructura sedimentaria", etc.*/}
					<View style = {{...localStyles.graphicColumn_header, paddingLeft: space}}>

						{/*Mensaje: "Rayos gamma"*/}
						{s.showGammaRay && header_aux(D.GAMMA_RAY_WIDTH, p.allMessages[21])}

						{/*Mensaje: "Información de estrato"*/}
						{s.showInfo && header_aux(D.STRATUM_INFORMATION_WIDTH, p.allMessages[22])}

						{/*Mensaje: "Litología"*/}
						{s.showLithology && header_aux(D.LITHOLOGY_PICKER_WIDTH, p.allMessages[23])}

						{/*Mensaje: "Estructura sedimentaria"*/}
						{s.showStructure && header_aux(D.STRUCTURE_PICKER_WIDTH, p.allMessages[24])}

						{/*Mensaje: "Fósiles"*/}
						{s.showFossils && header_aux(D.FOSSIL_PICKER_WIDTH, p.allMessages[25])} 

						{/*Mensaje: "Fotografías"*/}
						{s.showPictures && header_aux(D.IMAGE_PICKER_WIDTH, p.allMessages[26])} 

						{/*Mensaje: "Notas de texto"*/}
						{s.showNotes && header_aux(D.NOTE_WRITER_WIDTH, p.allMessages[27])} 
					</View>

					{/*//En esta parte están los datos superiores, como valores de gamma-ray y la regla de los no carbonatos*/}
					<View style = {{flexDirection: 'row', paddingLeft: space}}>

						{s.isCore && s.showGammaRay && 
							<View style = {{flexDirection: 'column'}}>
								<View style = {{
									height: conditionGammaRay ? 35 : 25, 
									paddingLeft: D.GAMMA_RAY_WIDTH 
										- conditionGammaRay * (3*(D.GAMMA_RAY_WIDTH+40)/4 + 16) 

								}}>
								{/*El "3 * (D.GAMMA_RAY_WIDTH+40)/4" que resta aparece porque la gráfica LineChart utiliza 3/4 de la altura proporcionada
							       (que en nuestro caso es la anchura) para representar la gráfica. El otro 1/4 es para colocar las etiquetas del eje x,
							       que son las verticales en nuestro caso. Además, recuérdese que a LineChart le pasamos como altura "D.GAMMA_RAY_WIDTH+40"
							       y no sólo D.GAMMA_RAY_WIDTH. El -16 es para terminar de ajustar los valores */}

									{!takingShot && s.gammaRaySuperiorLabels}
									{takingShot && conditionGammaRay && this.state.gammaRaySuperiorLabels}
								</View>

								{/*//Esto es sólo para dejar espacio entre los valores y la gráfica*/}
								<View style = {{height: 2}}/> 
							</View>
						}

						{/*//Aquí se muestra la regla que indica el diámetro del grano para los no carbonatos*/}   
						{s.showLithology && s.showNoCarbonatesRule &&

							<View style = {{
								paddingLeft: s.showInfo * D.STRATUM_INFORMATION_WIDTH // Espacio reservado para la información de estrato
											 + 50 // Para que la imagen siempre tenga un tamaño; de lo contrario, en la medición mínima no se mostraría nada
											 - (s.isCore && s.showGammaRay && conditionGammaRay) *
											 	(	// Recuperamos el espacio que se corrieron las etiquetas superiores del gamma-ray
											 		D.GAMMA_RAY_WIDTH - 3*(D.GAMMA_RAY_WIDTH+40)/4 - 16 + 

													// Sobrante de las etiquetas del gamma-ray
													( D.GAMMA_RAY_WIDTH*(3/4 + 3/(4*NUMBER_VERTICAL_GR_SEGMENTS) - 1) + 30*(1 + 1/NUMBER_VERTICAL_GR_SEGMENTS) )
								            	), 
							}}>
							{/*Se intentó usar la posición absoluta en vez de la relativa para evitar la complicada fórmula anterior, pero entonces los estratos se montaban sobre la regla*/}

								{/*Esto es para dejar un espacio superior cuando se muestra el gamma-ray, porque como allí la altura total es 37 = 35+2, entonces
								   esta regla, que ocupa menos espacio, se centra verticalmente, y eso no nos interesa. Queremos que esté tan pegada al estrato como cuando
								   no hay gamma-ray, por lo que ponemos una vista de altura 10, que es precisamente lo que falta aquí en total para alcanzar los 37*/}
								{(s.showGammaRay && conditionGammaRay) &&
									<View style = {{height: 10}}/> 
								}
								<p.noCarbonatesRule/>
							</View>
						}
					</View>
				</View>
			)
		} 
	}

	/// Esto es para mostrar los campos propiamente de cada uno de los estratos (Información, Litología, etc.)
	renderStratums(takingShot = false) {
		let state = this.state;
		let layerList = (takingShot) ? this.state.layerList_ForShot : this.state.layerList;

		/* Procedimiento auxiliar para mostrar un botón que sube o baja un estrato de posición según se indique
		   Si "rise" es True, el botón sube al estrato de posición, y si es False, lo baja */
		let buttonMoveStratum = (rise, buttonSize, item, i) => {
			return (
				<View style = {{alignItems:'center', justifyContent:'center', paddingRight: (rise ? 8 : 0), paddingLeft: (rise ? 0 : 8)}}>
					<ButtonWithIcon
						/* Es necesario poner el "() =>" para que el "this" se refiera al alcance externo 
						   y no al map del "layerList.map". Si se le quita, el botón se activa solo automáticamente */
						onPress = {rise ? () => this.riseLayerPosition(item,i) : () => this.lowerLayerPosition(item,i)}
						type    = "outline" 
						icon    = {<Icon  name={rise ? "arrow-up" : "arrow-down"}  size={buttonSize}  color="black"/>}
						raised
					/>
				</View>
			)
		}

		/// Tenemos que poner este condicional, porque se tarda un poco en asignar la columna estratigráfica a la variable
		if (layerList){
			return layerList.map((item,i) => (
				<View key={item.key+'_row'}>
					{(state.maxIndexStratums <= i) && (i <= state.minIndexStratums) &&
						<View style = {localStyles.container_row}> 

							{/*Botones para subir o bajar el estrato una posición, que sólo se muestran si no está 
							   la gráfica de gamma-ray y si no se está haciendo una captura del núcleo o afloramiento*/}
							{ ((!state.isCore) || (!state.showGammaRay)) && (!takingShot) &&
								<View style = {{width: UP_DOWN_BUTTONS_WIDTH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: item.shownHeight[state.unit]}}>
									{ (item.shownHeight[state.unit] >= 39) && buttonMoveStratum(true, 15, item, i)}
									{ (item.shownHeight[state.unit] >= 39) && buttonMoveStratum(false, 15, item, i)}

									{ (item.shownHeight[state.unit] >= 30) && (item.shownHeight[state.unit] < 39) && buttonMoveStratum(true, item.shownHeight[state.unit] * 0.2, item, i)}
									{ (item.shownHeight[state.unit] >= 30) && (item.shownHeight[state.unit] < 39) && buttonMoveStratum(false, item.shownHeight[state.unit] * 0.2, item, i)}
								</View>
							}

							{/*//Componentes de los estratos*/}
							{state.showInfo &&
								<Components.StratumInformation 
									height      = {item.shownHeight[state.unit]} 
									stratumName = {item.name}
									Object_id   = {state._id}
									thickness   = {item.thickness}
									lowerLimit  = {item.lowerLimit}
									upperLimit  = {item.upperLimit}
									width       = {D.STRATUM_INFORMATION_WIDTH}
									index       = {i}
									stratum_key = {item.key}
									unit        = {state.unit}
									baseHeight  = {state.baseHeight}
									navigation  = {this.props.navigation}
									scale       = {state.scale}
									isCore      = {state.isCore}
									takingShot  = {takingShot}
								/>
							}
							{state.showLithology &&
								<Components.LithologyPicker
									height       = {item.shownHeight[state.unit]} 
									stratumName  = {item.name}
									Object_id    = {this.state._id} 
									index        = {i}
									stratum_key  = {item.key}
									data         = {item.lithology_data}
									width        = {D.LITHOLOGY_PICKER_WIDTH}
									isCore       = {state.isCore}
									takingShot   = {takingShot}
								/>
							}
							{state.showStructure && 
								<Components.StructurePicker  
									height       = {item.shownHeight[state.unit]}
									stratumName  = {item.name}
									Object_id    = {state._id} 
									index        = {i}
									stratum_key  = {item.key}
									data         = {item.structure_data}
									width        = {D.STRUCTURE_PICKER_WIDTH}
									isCore       = {state.isCore}
									takingShot   = {takingShot}
								/>
							}
							{state.showFossils &&
								<Components.FossilPicker       
									height       = {item.shownHeight[state.unit]} 
									stratumName  = {item.name}
									Object_id    = {state._id}     
									index        = {i}
									stratum_key  = {item.key}
									navigation   = {this.props.navigation}
									data         = {item.fossil_data}
									width        = {D.FOSSIL_PICKER_WIDTH}
									isCore       = {state.isCore}
									takingShot   = {takingShot}
								/>
							}
							{state.showPictures &&
								<Components.ImagePicker
									height       = {item.shownHeight[state.unit]}
									stratumName  = {item.name}
									Object_id    = {state._id} 
									index        = {i}
									stratum_key  = {item.key}
									data         = {item.image_data}
									width        = {D.IMAGE_PICKER_WIDTH}
									isCore       = {state.isCore}
									takingShot   = {takingShot}
								/>
							}
							{state.showNotes &&
								<Components.NoteWriter
									height       = {item.shownHeight[state.unit]}
									Object_id    = {state._id} 
									index        = {i}
									stratum_key  = {item.key}
									data         = {item.note_data}
									width        = {D.NOTE_WRITER_WIDTH}
									isCore       = {state.isCore}
									takingShot   = {takingShot}
								/>
							}
						</View>
					}
					{ ((state.maxIndexStratums > i) || (i > state.minIndexStratums)) &&
						<View style = {{height: item.shownHeight[state.unit]}}/>
					}
				</View>
			))
		}
	}

	/// Esto es para mostrar la gráfica del gamma-ray al lado de los estratos
	renderGammaRay_Stratums(takingShot = false) {
		let state = this.state;

		if (takingShot) {
			return (
				<View style = {localStyles.container_row}>
					{state.gammaRayIsRendered && this.state.gammaRayValues_ForShot.hasOwnProperty('xValuesMeters') &&
						<View style = {{flexDirection: 'column'}}>
							<Components.GammaRayPlot
								gammaRayValues  = {this.state.gammaRayValues_ForShot}
								superiorLabels  = {state.gammaRaySuperiorLabels}
								topHeightCore   = {state.maxCapturedHeight[0]}
								width           = {D.GAMMA_RAY_WIDTH}
								unit            = {state.unit}
								scale           = {state.scale}
								key             = {0}
								numberVSegments = {NUMBER_VERTICAL_GR_SEGMENTS}
								takingShot      = {true}
							/>
						</View>
					}
					{state.showGammaRay && (!state.gammaRayValues.hasOwnProperty('xValuesMeters')) &&
						<View style = {{width: D.GAMMA_RAY_WIDTH}}/>
					}
					<View style = {localStyles.container_column}>
						{this.renderStratums(true)}			
					</View>

				</View>
			)
		}

		return (
			<View style = {localStyles.container_row}>
				{state.showGammaRay &&
					<Components.GammaRayPlot
						gammaRayValues  = {{}} // En este caso dejamos que se usen los datos de gamma-ray de la Tienda Redux
						topHeightCore   = {state.potentialMaxHeight[0]}
						width           = {D.GAMMA_RAY_WIDTH}
						unit            = {state.unit}
						scale           = {state.scale}
						key             = {0}
						numberVSegments = {NUMBER_VERTICAL_GR_SEGMENTS}
						takingShot      = {false}
					/>
				}
				<View style = {localStyles.container_column}>
					{this.renderStratums(false)}			
				</View>

			</View>
		)
	}

	// Parte inferior de la gráfica completa, que por el momento sólo incluye la regla de los carbonatos
	graphicsColumnFooter(space){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				{/*Aquí se muestra la regla que indica el diámetro del grano para los carbonatos*/}
				{s.showLithology && s.showCarbonatesRule &&
					<View style = {{
						flexDirection: 'column', 
						paddingLeft: 
							-0.5
							+ space // Espacio inicial que depende de si se están mostrando los botones de subir/bajar estrato o no
							+ (s.isCore && s.showGammaRay) * (D.GAMMA_RAY_WIDTH)
							+ s.showInfo*D.STRATUM_INFORMATION_WIDTH // Espacio reservado para el campo de información de estrato
							+ 50 + D.LITHOLOGY_ADDING_TERM/2, // 50 más la mitad de espacio entre una medición y otra, para que no coincidan con los no carbonatos
					}}>
						<p.carbonatesRule/>
					</View>
				}
				{/*//Esto es sólo para dejar espacio*/}
				<View style = {{height: 12}}/>
			</View>
		)
	}

	/// Esto sirve para determinar si hay que cargar más datos de la gráfica del gamma-ray y/o de los estratos cuando nos desplazamos verticalmente en la pantalla.
	//  - Si kind = 0, este método fue activado con la condición "onScroll".
	//  - Si kind = 1, este método fue activado con la condición "onMomentumScrollEnd"
	determine_LimitExceeded = ({layoutMeasurement, contentOffset, contentSize}, kind) => {
		let s  = this.state;
		let aF = auxiliarFunctions;

		// Aquí determinamos cuáles son los límites a considerar si se están sobrepasando o no ("top" y "bottom")
		// También los guardamos en variables aparte ("previousTop" y "previousBottom") para luego comparar los valores modificados con los anteriores
		let top, bottom, previousTop, previousBottom;

		// Caso en que estamos trabajando con núcleos
		if (s.isCore){
			top    = aF.max(s.maxHeightGammaRay_rendered, s.maxHeightStratums_rendered);
			bottom = aF.min(s.minHeightGammaRay_rendered, s.minHeightStratums_rendered);

			// Nótese que en "bottom" pusimos la mínima altura de las dos menores (rayos gamma y estratos), pero en realidad debería ser la máxima de las dos, porque 
			// es el primer límite que se sobrepasa al irse desplazando hacia abajo. Sin embargo, si por ejemplo la máxima de las dos es la de los estratos y ya no hay más
			// estratos que cargar, entonces ya no nos interesa considerar ese límite, sino el de los rayos gamma. El caso del "top" es análogo.
			// Por eso haremos la siguiente verificación para arreglar esos límites. Nótese que sólo importa si ninguno de los topes es nulo.
			if ((s.maxHeightGammaRay_rendered != null) && (s.maxHeightStratums_rendered != null)){
				if (s.maxHeightGammaRay_rendered < top) {
					if (s.maxHeightGammaRay_rendered < s.potentialMaxHeightGammaRay){
						top = s.maxHeightGammaRay_rendered;
					}
				}
				else if ((s.maxHeightStratums_rendered < top) && (s.maxHeightStratums_rendered < s.potentialMaxHeightStratums)){
					top = s.maxHeightStratums_rendered;
				}

				if (s.minHeightGammaRay_rendered > bottom) {
					if (s.minHeightGammaRay_rendered > s.potentialMinHeightGammaRay){
						bottom = s.potentialMinHeightGammaRay_rendered;
					}
				}
				else if ((s.minHeightStratums_rendered > bottom) && (s.minHeightStratums_rendered > s.potentialMinHeightStratums)){
					bottom = s.minHeightStratums_rendered;
				}
			}
			previousTop = top;
			previousBottom = bottom;
		} 
		else { // Caso en que estamos trabajando con afloramientos
			top = previousTop = s.maxHeightStratums_rendered;
			bottom = previousBottom = s.minHeightStratums_rendered;		
		}

		const currentLocation = layoutMeasurement.height + contentOffset.y; // Constante para el cálculo de los límites
		let limitWasExceeded  = false; // Indica que se sobrepasó alguno de los límites, y por consiguiente hay que cargar nuevos datos
		let nonContiguous     = false; // Indica que los datos que hay que cargar no son contiguos a los que ya estaban, sino que hay espacios de por medio

		// Caso en que estamos ascendiendo en la vista y se sobrepasó el límite superior
		if ( currentLocation-300 <= (s.potentialMaxHeight[0] - top) * s.factor ){
			// El 15 fue arbitrario. Es para que cuando se carguen los nuevos datos todavía sea visible parte de lo inferior, en vez de verse cortado
			bottom = aF.max(top - 15*s.scale[0], s.potentialMinHeight[0]); 
			top    = aF.min(bottom + SPACES_TO_SHOW*s.scale[0], s.potentialMaxHeight[0]);

			// Caso en que los datos a cargar no son los contiguos a los que ya estaban, sino varios espacios después
			if (((s.potentialMaxHeight[0] - top) * s.factor > contentOffset.y -5) && ((kind==1) || (s.userStablishedInitLimit))){
				nonContiguous = limitWasExceeded = true;
			} else {
				// Caso en que los datos a cargar son los contiguos. Es conveniente verificar si no se está haciendo ya una carga
				if (this.state.inmediateTopLoadEnabled){
					this.setState({inmediateTopLoadEnabled: false});
					limitWasExceeded = true;
				}
			}
		}
		// Caso en que estamos descendiendo en la vista y se sobrepasó el límite inferior
		else if ( currentLocation+300 >= (s.potentialMaxHeight[0] - bottom) * s.factor ){
			// El 15 fue arbitrario. Es para que cuando se carguen los nuevos datos todavía sea visible parte de lo superior, en vez de verse cortado
			top    = aF.min(bottom + 15*s.scale[0], s.potentialMaxHeight[0]); 
			bottom = aF.max(top - SPACES_TO_SHOW*s.scale[0], s.potentialMinHeight[0]); 

			// Caso en que los datos a cargar no son los contiguos a los que ya estaban, sino varios espacios después
			if (((s.potentialMaxHeight[0] - bottom) * s.factor < contentOffset.y -5) && ((kind==1) || (s.userStablishedInitLimit))){
				nonContiguous = limitWasExceeded = true;
			}
			else {
				// Caso en que los datos a cargar son los contiguos. Es conveniente verificar si no se está haciendo ya una carga
				if (this.state.inmediateBottomLoadEnabled){
					this.setState({inmediateBottomLoadEnabled: false});
					limitWasExceeded = true;
				}	
			}	
		}
		// En caso de que hayamos entrado estableciendo un límite, ya para la siguiente deslizada hay que quitar esa condición
		this.setState({userStablishedInitLimit: false}); 

		// Caso en que hay que cargar nuevos datos porque se sobrepasó algún límite
		if (limitWasExceeded){
			if (nonContiguous){
				top    = aF.min(s.potentialMaxHeight[0] - ((contentOffset.y-5) / s.factor) + (SPACES_TO_SHOW/2)*s.scale[0], s.potentialMaxHeight[0]);
				bottom = aF.max(top - SPACES_TO_SHOW*s.scale[0], s.potentialMinHeight[0]);
			}
			if ((top!=previousTop) && (bottom!=previousBottom)){
				this.loadMoreData(bottom, top);
			}
		}
	}

	// Esto sirve para cargar más datos de la gráfica del gamma-ray y/o de los estratos cuando nos desplazamos verticalmente en la pantalla 
	loadMoreData = async(bottom, top) =>{
		// Declaración de variables que necesitaremos
		let s = this.state;
		let aF = auxiliarFunctions;
		let {minIndexStratums, maxIndexStratums, minHeightStratums_rendered, maxHeightStratums_rendered} = this.state;
		let minHeightForVerticalRule, maxHeightForVerticalRule;

		if (s.stratumsAreAvailable){
			( {minIndexStratums, maxIndexStratums, minHeightStratums_rendered, maxHeightStratums_rendered} = await this.getLayerList_Limits(bottom, top) );
		}
		if (s.isCore){
			let {minHeightGammaRay_rendered, maxHeightGammaRay_rendered} = this.state;

			if (s.gammaRayIsRendered){
				( {minHeightGammaRay_rendered, maxHeightGammaRay_rendered} = await this.getGammaRayValues_Extract(top) );
			}
			minHeightForVerticalRule = aF.max( aF.min(minHeightGammaRay_rendered, minHeightStratums_rendered)-s.additionalHeightVerticalRule,  s.potentialMinHeight[0] );
			maxHeightForVerticalRule = aF.min( aF.max(maxHeightGammaRay_rendered, maxHeightStratums_rendered)+s.additionalHeightVerticalRule,  s.potentialMaxHeight[0] );

			this.setState({minHeightGammaRay_rendered, maxHeightGammaRay_rendered})
		}
		else {
			minHeightForVerticalRule = aF.max( minHeightStratums_rendered-s.additionalHeightVerticalRule,  s.potentialMinHeight[0] );
			maxHeightForVerticalRule = aF.min( maxHeightStratums_rendered+s.additionalHeightVerticalRule,  s.potentialMaxHeight[0] );
		}

		this.setState({
			verticalRule: this.createVerticalRule(minHeightForVerticalRule, maxHeightForVerticalRule, (s.potentialMaxHeight[0] - maxHeightForVerticalRule), (minHeightForVerticalRule - s.potentialMinHeight[0])),
			minIndexStratums, maxIndexStratums, minHeightStratums_rendered, maxHeightStratums_rendered,
			inmediateBottomLoadEnabled: true, inmediateTopLoadEnabled: true,
		});
	}

	// Esta vista llama a su vez a otras vistas para construir las gráficas con sus respectivos encabezados y sus contenidos
	graphicsColumn(takingShot) {
		let s = this.state;
		let p = this.props;

		// En los núcleos normalmente se mostrarán valores con un signo negativo; por eso dejamos más espacio en ellos que en los afloramientos
		let excess = ((s.isCore) ? 115 : 101);
		let verticalRule_width = ((s.isCore) ? 110 : 95);

		// Estructura para cuando estamos tomando una captura
		if (takingShot){
			let space = excess; // Espacio horizontal a partir del cual comenzará a mostrarse el encabezado de los campos
			return (
				<View>
					<Modal visible = {this.state.plotViewVisible}>
						<ScrollView horizontal>
							<ScrollView>
								<ViewShot // Tenemos que colocar este componente dentro de los dos ScrollViews para que se capture toda la vista
									style = {localStyles.white_background}
									ref     = "viewShot"
									options = {{ format: s.imageFormat, quality: 1 }}
								>
									{this.objectInformationHeader(true)}

									<View style = {localStyles.container}> 
										<View style = {{flexDirection: 'row'}}>
											<View style = {localStyles.container_column}>

												{this.graphicsColumnHeader(space, true)}

												{/*Aquí se muestra la regla vertical junto a las gráficas*/}
												<View style = {{paddingTop: 5, flexDirection: 'column'}}>
													<View style = {{flexDirection: 'row'}}> 
														{/*Regla horizontal*/}
														<View style = {{width: verticalRule_width}}>
															{s.verticalRule_ForShot}
														</View>
														{/*// Gráficas*/}
														{this.renderGammaRay_Stratums(true)}
													</View>
												</View>

												{this.graphicsColumnFooter(space)}

											</View>
										</View>
									</View>

								</ViewShot>
							</ScrollView>
						</ScrollView>
					</Modal>
				</View>
			)
		}

		// --------- Estructura para cuando la aplicación es la que está mostrando la gráfica -----------
		
		// Espacio horizontal a partir del cual comenzará a mostrarse el encabezado de los campos
		let space = s.showGammaRay ? excess : excess + UP_DOWN_BUTTONS_WIDTH; 
		return(
			<View style = {localStyles.container}> 

				<ScrollView horizontal>
					<View style = {localStyles.container_column}>

						{this.graphicsColumnHeader(space)}

						{/*Aquí se muestra la regla vertical junto a las gráficas*/}
						<ScrollView 
							ref   = "verticalScrollView"
							style = {{paddingTop: 5}}
							onScroll            = {({nativeEvent}) => {this.determine_LimitExceeded(nativeEvent, 0)}}
							onMomentumScrollEnd = {({nativeEvent}) => {this.determine_LimitExceeded(nativeEvent, 1)}}
							onScrollToTop       = {() => this.setState({inmediateTopLoadEnabled: false})}
						>
							<View style = {{flexDirection: 'row'}}> 
								<View style = {{width: verticalRule_width}}>
									{(s.stratumsAreAvailable || s.gammaRayIsRendered) && s.verticalRule}
								</View>

								{/*//Gráficas*/}
								{(s.stratumsAreAvailable || s.showGammaRay) && this.renderGammaRay_Stratums()}

							</View>
						</ScrollView>

						{this.graphicsColumnFooter(space)}

					</View>
				</ScrollView>
			</View>
		)
	}

	// Esta función devuelve un modal que sirve como estructura genérica de "initialLimitPreview" y "takeShotPreview"
	modalStructure(boolVisible, headerMessage, cancelFunction, acceptFunction, mainView) {
		let s = this.state;
		let p = this.props;

		let anObjectIsShown = (((s.numberLayers != 0) && s.stratumsAreAvailable) || (s.gammaRayIsRendered) );

		// Función auxiliar para representar la cabecera de las vistas en modales
		function header(message){
			return(
				<View style = {genericStyles.modalHeader}>
					<Text style = {{justifyContent: 'center', alignItems: 'center', fontSize: 17, fontWeight: 'bold'}}>{message}</Text>
				</View>
			)
		}

		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {false}
					visible        = {boolVisible && this.props.navigation.isFocused()}
					onRequestClose = {() => cancelFunction()}
				>
					{/*Caso en que sí hay gráfica disponible*/}
					{anObjectIsShown &&
						<View style = {genericStyles.lightGray_background}>
							{header(headerMessage)}
							{mainView}

							{/*Vista de los botones para darle Aceptar o Cancelar*/}
							<View style = {genericStyles.down_buttons}>
								<View style = {{paddingRight: 25}}>
									<ButtonNoIcon 
										raised
										title   = {p.allMessages[28]} // Mensaje: "Cancelar"
										color   = {DARK_GRAY_COLOR}
										onPress = {s.keyboardAvailable ? Keyboard.dismiss : (() => {cancelFunction()}) }
									/>
								</View>

								<View style = {{paddingLeft: 25}}>
									<ButtonWithIcon
										raised
										title   = {p.allMessages[29]} /// Mensaje: "Aceptar"
										icon    = {{name: 'check'}}
										onPress = {s.keyboardAvailable ? Keyboard.dismiss : (() => {acceptFunction()})}
									/>
								</View>
							</View>
						</View>
					}

					{/*//Caso en que no hay gráfica*/}
					{!anObjectIsShown &&
						<View style = {genericStyles.lightGray_background}>
							{header(headerMessage)}
							<View style = {{...genericStyles.white_background_without_ScrollView, justifyContent: 'center'}}>
								{/*Mensaje: "No hay elementos para mostrar"*/}
								<Text style = {{textAlign: 'center'}}>{p.allMessages[32]}</Text>
							</View>

							{/*Vista del botón para darle Volver*/}
							<View style = {genericStyles.down_buttons}>
								<ButtonNoIcon 
									raised
									title   = {p.allMessages[30]} // Mensaje: "Volver"
									color   = {DARK_GRAY_COLOR}
									onPress = {() => {cancelFunction()}}
								/>
							</View>
						</View>
					}
				</Modal>
			</View>
		)
	}

	// Estructura genérica de cuando se pide un dato numérico, usada también por "initialLimitPreview" y "takeShotPreview"
	numericField(mainMessage, variable, variableName, maximumMessage, minimumMessage){
		let s = this.state;
		let p = this.props;

		return(
			<View style = {genericStyles.instructionsAboveTextInputs}>
				<Text style = {{flex: 1, color: 'red', fontWeight: 'bold', textAlign: 'center'}}>*
					<Text style = {{color: 'black'}}> {mainMessage}</Text>
				</Text>

				{/*Mensajes: "Máximo" "metros" "pies*/}
				{maximumMessage && 
					<View style = {{...genericStyles.simple_center, paddingTop: (minimumMessage ? 5 : 0)}}>
						<Text style = {{flex: 1, paddingBottom: 3}}>{p.allMessages[34]}:   {s.potentialMaxHeight[1]} {s.unitMessage}</Text>
					</View>
				}

				{/*Mensajes: "Mínimo" "metros" "pies"*/}
				{minimumMessage && 
					<View style = {genericStyles.simple_center}>
						<Text style = {{flex: 1, paddingBottom: 3}}>{p.allMessages[37]}:   {s.potentialMinHeight[1]} {s.unitMessage}</Text>
					</View>
				}			
				<TextInput 
					value             = {variable[1]}
					selectTextOnFocus = {true}
					textAlign         = {'center'}    
					style             = {{...genericStyles.textInput, width: '70%'}}
					placeholder       = {p.allMessages[38]} // Mensaje: "Rellenar campo..."
					onChangeText      = {text => this.onChangeNumericValue(variableName, text)}
					keyboardType      = 'phone-pad'
				/>
			</View>
		)
	}

	// Para establecer la altura superior que se desea comenzar a ver. Esto es útil cuando la vista es demasiado grande
	initialLimitPreview(){
		let s = this.state;
		let p = this.props;

		let boolVisible      = s.initLimitPreviewVisible;
		const cancelFunction = this.closeInitLimitPreview;
		const acceptFunction = this.stablishInitLimit;
		const headerMessage  = p.allMessages[31] // Mensaje: "Ver gráfica desde altura establecida"

		let mainView = (
			<View style = {genericStyles.white_background_with_ScrollView}> 
				<ScrollView>
					<View style = {{paddingTop: '11%'}}>
						{/*Mensaje: "Inserte la altura que desea ubicar en la vista"*/}
						{this.numericField(p.allMessages[33], s.maxCapturedHeight, 'maxCapturedHeight', true, true)}
					</View>
				</ScrollView>
			</View>
		)

		return(
			this.modalStructure(boolVisible, headerMessage, cancelFunction, acceptFunction, mainView)
		)
	}

	/// Para establecer los límites de captura del núcleo o afloramiento
	takeShotPreview(){
		let s = this.state;
		let p = this.props;

		let boolVisible      = s.takeShotPreviewVisible;
		const cancelFunction = this.finishTakingShot;
		const acceptFunction = this.takeShot;
		const headerMessage  = p.allMessages[39] // Mensaje: "Captura de gráfica"

		let mainView = (
			<View style = {genericStyles.lightGray_background}>
				{/*En esta parte el usuario ingresa los parámetros de la captura*/}
				<View style = {{...genericStyles.white_background_with_ScrollView, flex: 1}}> 
					<ScrollView>
						<View style = {{paddingTop: (s.isCore ? '3%' : '10%')}}>

							{/*Mensaje: "Cota superior de captura"*/}
							{this.numericField(p.allMessages[40], s.maxCapturedHeight, 'maxCapturedHeight', true, false)}

							{/*Mensaje: "Cota inferior de captura"*/}
							{this.numericField(p.allMessages[41], s.minCapturedHeight, 'minCapturedHeight', false, true)}

							{/*Escoger el formato de la imagen a mostrar*/}
							<View style = {{...genericStyles.row_instructions_textInput, paddingTop: 30}}>
								<View style = {{justifyContent: 'flex-end'}}>
									{/*Mensaje: "Formato de\nimagen"*/}
									<Text style = {{flex:1}}>{p.allMessages[42]}: </Text>
								</View>
								<View style = {{justifyContent: 'flex-start'}}>
									<Picker
										selectedValue = {s.imageFormat}
										style         = {{height: 30, width: 100, flex: 1}}
										onValueChange = {(itemValue, itemIndex) => this.setState({imageFormat: itemValue})}
									>
										<Picker.Item label = {p.allMessages[43]}  value = {"jpg"}/>
										<Picker.Item label = {p.allMessages[44]}  value = {"png"}/>
									</Picker>
								</View>
							</View>
						</View>
					</ScrollView>
				</View>

				{s.gammaRayIsRendered && // Mostrar mensaje al usuario de que la gráfica de gamma-ray puede dar problemas
					<View style = {{paddingLeft: '5%', paddingRight: '5%', paddingTop: 5}}>
						{/*Mensaje: "¡Advertencia!"*/}
						<Text style = {{textAlign: 'center', color: 'red', fontSize: 13}}>{p.allMessages[45]}</Text>
						{/*//Mensaje: "Con la escala actual" ... "no se recomienda capturar más de " ... "[metros/pies]" 
						//... ", ya que podrían ocurrir errores con el gráfico de rayos gamma"*/}
						<Text style = {{textAlign: 'center', fontSize: 12}}>{p.allMessages[46]} ({s.scale[1]}) {p.allMessages[47]}
							{auxiliarFunctions.repairNumber(SPACES_TO_SHOW*s.scale[0], 20)[1]} {s.unitMessage}{p.allMessages[48]}</Text>
					</View>
				}

				{/*Mensaje que indica el tamaño representado en la imagen*/}
				<View style = {{...genericStyles.smallRow, flex: 0.04}}>
					{/*Mensajes: "Tamaño de captura" ... "[metros/pies]"*/}
					<Text style = {{textAlign: 'center', color: 'blue'}}>
						{p.allMessages[49]}:  {auxiliarFunctions.repairNumber(s.maxCapturedHeight[0]-s.minCapturedHeight[0], 20)[1]} {s.unitMessage}
					</Text>
				</View>
			</View>
		)

		return(
			this.modalStructure(boolVisible, headerMessage, cancelFunction, acceptFunction, mainView)
		)
	}

	/// Sirve para activar la función que lee desde la base de datos. Esto es útil cuando estamos emulando la aplicación y refrescamos la página
	// en caliente, ya que hacer eso volverá a colocar this.state.loading en su valor inicial (true) pero este componente ya estará montado, por lo que 
	// no se activará el NavigationEvents onWillFocus, y en consecuencia la vista se quedará pegada en "Cargando"
	activateLoadObjectInfo(){
		if (this.state.loadFunctionOpened){
			this.setState({loadFunctionOpened: false}, () => this.loadObjectInfo());
		}
		return(<View/>)
	}

	// Lo que se muestra al usuario en total en esta ventana
	render (){
		let s = this.state;
		let p = this.props;

		// Vista para cuando se están cargando datos desde la base de datos PouchDB
		if (this.state.loading || this.props.loadView){
			return (
				<View style = {genericStyles.simple_center}>
					{!this.state.takingShot && this.activateLoadObjectInfo()}
					<ActivityIndicator size = "large" color = "#0000ff" />
					{/*Mensajes: "Generando imagen" "Cargando"*/}
					<Text>{s.takingShot ? p.allMessages[50] : p.allMessages[51]}...</Text> 
				</View>
			);	
		} 
		let informationIsRendered = (s.gammaRayIsRendered || s.stratumsAreAvailable);
		// Vista para cuando ya se actualizaron los datos que se quieren mostrar
		return (
			<View style = {localStyles.lightGray_background}>
				{/*Modales*/}
				{this.initialLimitPreview()}
				{this.takeShotPreview()} 

				<View style = {localStyles.white_background}>
					{this.objectInformationHeader()}
					{informationIsRendered && this.graphicsColumn(this.state.takingShot)}
					{!informationIsRendered &&
						<View style = {{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
							{/*Mensaje: "No hay elementos para mostrar"*/}
							<Text style = {{textAlign: 'center'}}>{p.allMessages[32]}</Text>
						</View>
					}
				</View>

				{/*//Botones de la parte inferior*/}
				<View style = {{...genericStyles.down_buttons, flex: 0.15}}>
					<View style = {{flex: 0.05}}/>

					{/*Botón para ir al menú en donde se configura la captura del núcleo o afloramiento*/}
					<View style = {{flex: 0.2}}>
						<ButtonWithIcon 
							raised
							onPress = {() => this.openTakeShotPreview()}
							icon    = {<Icon  name="file-photo-o"  size={24}  color={LIGHTGRAY_COLOR}/>}
						/>
					</View>

					<View style = {{flex: 0.1}}/>

					{/*Botón para modificar el núcleo o afloramiento*/}
					<View style = {{flex: 0.7}}>
						<ButtonWithIcon 
							raised
							icon     = {{name: 'create'}}
							title    = {p.allMessages[52]} // Mensaje: "Editar información"
							onPress  = {this.editObjectInfo}
						/>
					</View>

					<View style = {{flex: 0.05}}/>
				</View>
			</View>
		)
	}
}

// Constante para darle formato a los diversos componentes de esta ventana
const localStyles = StyleSheet.create({

	// Formato de la cabecera de la pantalla, que aparece en la parte superior
	objectInfo_header: {
		flexDirection:  'row',
		alignItems:     'center',
		height:         43,
	},

	// Formato de la parte izquierda de la cabecera de la pantalla
	objectInfo_header_text: {
		flex:           1,
		flexDirection:  'column',
		justifyContent: 'center',
		alignItems:     'flex-start',
		paddingTop:     15,
		paddingLeft:    10,
	},

	// Cabecera de los campos de los estratos, que dice: "Litología", "Estructura sedimentaria", etc.
	graphicColumn_header: {
		flexDirection:  'row',
		height:         30,
		paddingBottom:  25,
	},

	// Formato de la cabecera en la que se muestra el título de cada campo de un estrato (Litología, etc.)
	field_section: {
		borderColor:    'black',
		borderWidth:    2,
		justifyContent: 'center',
		alignItems:     'center',
		height:         25,
	},

	// Contiene la gráfica en total
	container: {
		flexDirection:  'column',  
		padding:        20  
	},

	// Usado para que los distintos estratos aparezcan uno encima del otro (columna) y no horizontalmente
	container_column: {
		flex:           1,
		flexDirection:  'column',
		opacity:        1,
		paddingLeft:    5,
	},

	// Usado para mostrar los distintos campos de registro en fila
	container_row: {
		flexDirection:  'row',
		justifyContent: 'flex-start',
	},

	// Crea un fondo gris claro, que permite que el sector donde están los botones de abajo se diferencie del resto del contenido
	lightGray_background: { 
		flex:            1, 
		flexDirection:   'column',
		backgroundColor: LIGHTGRAY_COLOR,
	},

	// Crea un fondo blanco. Se superpone al fondo gris
	white_background: {
		flexDirection:   'column', 
		paddingTop:      20, 
		flex:            0.9, 
		backgroundColor: 'white',
	},
});

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages:      ObjectScreen_Texts[state.appPreferencesReducer.language],  
		user_id:          state.userReducer.user_id,
		localDB:          state.userReducer.localDB,
		noCarbonatesRule: state.libraryReducer.noCarbonatesRule,
		carbonatesRule:   state.libraryReducer.carbonatesRule,
		loadView:         state.popUpReducer.loadView,
		gammaRayValues_Extract:   state.popUpReducer.gammaRayValues_Extract,
		enteringComponentEnabled: state.popUpReducer.stratumComponentEnabled,
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchChangeLoadView:   (bool) => dispatch(changeLoadView(bool)),
		dispatchGammaRay_Extract: (object) => dispatch(changeGammaRay_Extract(object)),
		dispatchStackScreenPropsFunction: (globalFunction) => dispatch(changeStackScreenPropsFunction(globalFunction)),
		dispatchEnteringPermission: (bool) => dispatch(changeStratumComponentPermission(bool)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(ObjectScreen);