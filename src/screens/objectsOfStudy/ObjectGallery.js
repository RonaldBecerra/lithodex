import React, { Component } from 'react';
import { Button as ButtonNoIcon, Text, View, ScrollView,
	     ActivityIndicator, Modal, Alert, Linking} from 'react-native';

import { ListItem, Button as ButtonWithIcon} from 'react-native-elements'

import Icon from 'react-native-vector-icons/MaterialCommunityIcons'

import { NavigationEvents } from 'react-navigation'
import { connect } from 'react-redux'
import { ObjectGallery_Texts } from '../../languages/screens/objectsOfStudy/ObjectGallery'

import * as ExpoFileSystem     from 'expo-file-system'
import * as ExpoDocumentPicker from 'expo-document-picker'
import * as ExpoMediaLibrary   from 'expo-media-library'

import * as Log from '../../genericFunctions/logFunctions'
import * as Database from '../../genericFunctions/databaseFunctions'
import * as auxiliarFunctions from '../../genericFunctions/otherFunctions'
import { genericStyles, DARK_GRAY_COLOR } from '../../constants/genericStyles'
import { UNAUTHENTICATED_ID, OUTCROPS_DOCUMENT_ID, CORES_DOCUMENT_ID } from '../../constants/appConstants'
import { generateObject_id } from '../../genericFunctions/otherFunctions'


class ObjectGallery extends Component {

	constructor(props) {
		super(props)
		this.state = {
			...this.props.navigation.state.params,
			loading:               true,  // Variable que determina si todavía se están cargando los objetos desde la base de datos
			loadFunctionOpened:    true, // Indica si se puede ingresar a la función loadObjects
			renderList:            [],    // Lista de objetos que se muestran en pantalla
			optionsModalVisible:   false, // Determina si está visible el modal que muestra las opciones de un objeto de estudio
			newObjectModalVisible: false, // Determina si está visible el modal que permite decidir si el nuevo objeto se agrega desde archivo o si se rellena uno nuevo
			selectedObject:        null,  /* Esta variable tendrá el objeto que se haya seleccionado en la lista de objetos, bien sea para luego mostrar el modal
			                                 o para ir a la ventana donde están sus estratos.*/
			modalsEnabled:         true,  // Variable que indica que se puede acceder a los modales. Se hace falsa en el momento en que estamos navegando a otra vista

			// Contiene la cadena "núcleo" o "afloramiento" según sea el caso, en el idioma actual
			objectTypeMessage: (this.props.navigation.getParam('isCore') ? this.props.allMessages[0] : this.props.allMessages[1]),

			// Hace que también se muestre el símbolo de "Cargando", aunque no se leerá de la base de datos
			readingOrSavingObject: false,
		}
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps, navigation }) => ({
		title: (navigation.state.params.isCore) ? ObjectGallery_Texts[screenProps.language][2] : ObjectGallery_Texts[screenProps.language][3],
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		}
	});

	// Función para cargar los objetos desde la base de datos
	loadObjects = async() => {
		let s = this.state;
		let p = this.props;
		const documentID = (s.isCore ? CORES_DOCUMENT_ID : OUTCROPS_DOCUMENT_ID);

		p.localDB.get(documentID)
			.then(document => {
				let objects = document.objects;
				let objectsArray = Object.keys(objects).map((key) => ({...objects[key]}));

				this.setState({
					loading: false,
					loadFunctionOpened: true,
					modalsEnabled: true,
					renderList: objectsArray.map((item, index) => (
						<ListItem
							chevron
							bottomDivider							
							key         = {item._id}
							onPress     = {() => {this.goToObjectScreen(item)}}
							onLongPress = {() => {this.showOptionsModal(item)}}
							title       = {item.name}  
							subtitle    = {
								(s.isCore) ? (
										p.allMessages[4] + this.substituteNull(item.date) + "\n" + p.allMessages[5] + this.substituteNull(item.locationInWords)
										+ "\n" + p.allMessages[6] + this.substituteNull(item.baseHeight[item.unit][0], ((item.unit == 0) ? ' m' : ' ft'))
										+ "\n" + p.allMessages[7] + this.substituteNull(item.endHeight[item.unit][0], ((item.unit == 0) ? ' m' : ' ft'))
										+ "\n" + p.allMessages[8] + this.substituteNull(item.DF[item.unit][0], ((item.unit == 0) ? ' m' : ' ft'))
										+ "\n" + p.allMessages[9] + this.substituteNull(item.GL[item.unit][0], ((item.unit == 0) ? ' m' : ' ft'))
										//+ "\n" + p.allMessages[5] + item.TVD[item.unit][0] + ((item.unit == 0) ? ' m' : ' ft')
										//+ "\n" + p.allMessages[6] + item.R[item.unit] + ((item.unit == 0) ? ' m' : ' ft')
									) : (
										p.allMessages[4] + this.substituteNull(item.date) + "\n" + p.allMessages[5] + this.substituteNull(item.locationInWords) + "\n" +
										p.allMessages[6] + this.substituteNull(item.baseHeight[item.unit][0], ((item.unit == 0) ? ' m' : ' ft'))
									)
							}
						/>
					))
				})
			}).catch(function(error){
				console.error(error.toString());
			})
	}

	// Para registrar en el "log" que se entró en la galería
	componentDidMount(){
		Log.log_action({entry_code: 4, user_id: this.props.user_id, isCore: this.state.isCore});
	}

	// Función para que cuando haya un campo nulo, en lugar de mostrarse la palabra "null" se muestre "---"
	substituteNull = (mainMessage, secondMessage='') => {
		if (mainMessage == null){
			return("---")
		} else {
			return mainMessage.toString() + secondMessage.toString();
		}
	}

	// Función que determina si se puede navegar a otra vista
	canNavigate(){
		return !(this.state.newObjectModalVisible || this.state.optionsModalVisible)
	}

	// Lleva a la vista en la que se muestra la gráfica del objeto de estudio
	// Se activa cuando se presiona de forma rápida sobre el nombre de uno de los elementos
	goToObjectScreen(object) {
		if (this.canNavigate()){
			this.setState({modalsEnabled: false});
			this.props.navigation.navigate({ key: 'ObjectScreen', routeName: 'ObjectScreen', params: {...object, isCore: this.state.isCore}});
		}
	}

	// Hace que se vea la subventana con las opciones para un elemento
	// Se activa cuando se deja presionado largamente sobre el nombre del elemento.
	showOptionsModal(object) {  	
		this.setState({
			selectedObject:      object,
			optionsModalVisible: true,
		})
	}

	// Para cerrar la subventana del modal anterior
	closeOptionsModal = () => {
		this.setState({optionsModalVisible: false});
	}

	// Para que se vea subventana con la doble opción para agregar un objeto, ya sea caégándolo desde archivo o creando uno completamente nuevo
	showNewObjectModal(){
		this.setState({newObjectModalVisible: true});
	}

	// Para cerrar la subventana del modal de nuevo afloramiento
	closeNewObjectModal = () => {
		this.setState({
			newObjectModalVisible: false,
			loading:               false,
		});
	}

	// Muestra la localización del objeto en Google Maps
	showLocationInGoogleMaps(object) {
		let p = this.props;

		if ((object.latitude[0] != null) && (object.longitude[0] != null)){
			this.props.navigation.navigate({ key: 'GoogleMaps', routeName: 'GoogleMaps', params: {...object, isCore: this.state.isCore}});
			this.setState({optionsModalVisible: false});
		}
		else {
			// Alerta: "No se puede abrir el mapa porque las coordenadas de este [núcleo/afloramiento] no son válidas"
			Alert.alert(p.allMessages[10], p.allMessages[11](this.state.objectTypeMessage));
		}
	}

	/* Muestra la localización del afloramiento en Google Earth. (Esto implica salirnos de la aplicación)
	
	   Lo logré haciendo uso de este enlace: 
	   https://stackoverflow.com/questions/56960146/creating-a-dynamic-google-earth-web-link
	 */
	async showLocationInGoogleEarth(object) {
		let p = this.props;

		const latitude  = object.latitude;
		const longitude = object.longitude;

		// El 10000 lo obtuve probando. Es necesario para que la cámara esté por encima de lo que queremos ver
		const altitudeMeters = this.state.isCore ? (object.GL[0][0] + 10000).toString() : (object.baseHeight[0][0] + 10000).toString(); 

		var url = "https://earth.google.com/web/";

		if ((latitude[0] != null) || (longitude[0] != null)){
			url += "@" + latitude[1] + "," + longitude[1] + "," + altitudeMeters + "a";

			const canOpen = await Linking.canOpenURL(url);
			this.setState({optionsModalVisible: false});

			if (canOpen){
				Linking.openURL(url);
			}
			else {
				// Alerta: "No se puede abrir este enlace"
				Alert.alert(p.allMessages[10], p.allMessages[12]);
			}	
		}	
		else {
			// Alerta: "No se puede abrir el mapa porque las coordenadas de este [núcleo/afloramiento] no son válidas"
			Alert.alert(p.allMessages[10], p.allMessages[11](this.state.objectTypeMessage));
		}
	}

	// Se usa cuando vamos al formulario de afloramiento o núcleo para crear uno nuevo, no editar uno ya existente
	newObject = () => {
		this.closeNewObjectModal();
		this.props.navigation.navigate({ key: 'ObjectForm', routeName: 'ObjectForm', params: {isCore: this.state.isCore}});
	}

	// Lleva a la misma vista que cuando se está creando un afloramiento o núcleo, sólo que ahora
	// se está pasando uno ya creado como parámetro, por lo que se cargarán sus datos previos.
	editObjectInfo(object) { 
		this.setState({optionsModalVisible: false}); 	
		this.props.navigation.navigate({ key: 'ObjectForm', routeName: 'ObjectForm', params: {...object, isCore: this.state.isCore}});
	}

	// Función para salvar el objeto en un archivo, y las imágenes de sus estratos en carpetas separadas
	async saveObjectOnFile(object) {
		const { status } = await ExpoMediaLibrary.requestPermissionsAsync();

		if (status === "granted") {
			try{
				this.closeOptionsModal();
				this.setState({readingOrSavingObject: true});

				// Carpeta en la que se salvará el archivo
				const folder = "Lithodex/" + this.props.user_id + (this.state.isCore ? "/Cores/" : "/Outcrops/") + object.name + "_" + object._id;

				// Primero vamos a salvar las imágenes de los estratos, cada una en una carpeta distinta
				let stratums = object.layerList;
				for (i = 0; i < stratums.length; i++){
					let stratum       = stratums[i]; // Estrato actual
					let listOfImages  = stratum.image_data.listOfImages; // Lista de imágenes del estrato actual
					let stratumFolder = folder+"/"+stratum.name+"_"+stratum.key; // Carpeta en la que salvaremos las imágenes de este estrato

					let keysToDelete = [];

					if (listOfImages != null){
						var j = 0;
						for (j = 0; j < listOfImages.length; j++){
							let elem = listOfImages[j];
							let noError = true;
							let base64 = null;
							await this.props.localDB.get(elem.key)
								.then(async(document) =>{
									base64 = await document.base64;
								})
								.catch(function(error){
									keysToDelete.push(elem.key);
									noError = false;
								})
							if (noError){
								// Tenemos que crear un archivo provisional en la caché en donde guardaremos la imagen
								let fileUri = ExpoFileSystem.documentDirectory + elem.key +".jpg"; 

								// Esto significa que en el archivo ubicado en "fileUri" escribimos la cadena "base64"
								await ExpoFileSystem.writeAsStringAsync(fileUri, base64, {encoding: 'base64'});

								// Creamos un asset a partir de la dirección que acabamos de crear. No sirve hacerlo directamente con "base64"
								// ni con URI_PREFIX + base64
								const assetImage = await ExpoMediaLibrary.createAssetAsync(fileUri);

								/* Nótese que en el archivo que vamos a guardar, cada elemento de "listOfImages" tendrá la propiedad "uri", que no la tienen los elementos 
								   de la lista equivalente almacenada en la base de datos. Esa "uri" permitirá recuperar los archivos de imágenes cuando leamos el documento
								   "information", y una vez cargados los datos esa propiedad será borrada de los objetos.

								   Según la siguiente fuente, la ruta inicial funciona también en iOS, aunque aquí no lo hemos podido comprobar: 
								   https://stackoverflow.com/questions/60134920/how-to-store-a-uiimage-into-iphones-app-folder-with-xamarin-ios */
								elem.uri = "/storage/emulated/0/"+stratumFolder+"/"+assetImage.filename;

								/*El tercer argumento "false" sirve para que la imagen que acabamos de crear: "assetImage" no se copie
								  sino que se mueva a la nueva carpeta que deseamos. De esta forma, no tenemos dos apariciones de ella */
								await ExpoMediaLibrary.createAlbumAsync(stratumFolder, assetImage, false);

								// Borramos el documento que se creó provisionalmente en la caché y el asset
								ExpoFileSystem.deleteAsync(fileUri);
								ExpoMediaLibrary.deleteAssetsAsync([assetImage]);
							}
						}
						// Borramos las imágenes que no pudieron ser encontradas
						stratum.image_data.listOfImages = await listOfImages.filter(function(item){
							return !keysToDelete.includes(item.key)
						})
					}
				}
				// El nombre del archivo principal será "information"
				let fileUri = ExpoFileSystem.documentDirectory + "information" +".txt"; 

				// El archivo en donde está salvado el objeto, que es un JSON, lo convertimos a cadena de caracteres y lo salvamos en la dirección "fileUri"
				await ExpoFileSystem.writeAsStringAsync(fileUri, JSON.stringify(object), { encoding: ExpoFileSystem.EncodingType.UTF8 });

				// El "fileUri" tenemos que convertirlo en un archivo
				const assetFile = await ExpoMediaLibrary.createAssetAsync(fileUri);

				// Salvamos el archivo en la carpeta "folder"
				await ExpoMediaLibrary.createAlbumAsync(folder, assetFile, false); 

				this.setState({readingOrSavingObject: false});

				// Alerta: "El [núcleo/afloramiento] fue salvado"
				Alert.alert(this.props.allMessages[10], this.props.allMessages[13](this.state.objectTypeMessage));

				// Borramos el documento que se creó provisionalmente en la caché y el asset
				ExpoFileSystem.deleteAsync(fileUri);
				ExpoMediaLibrary.deleteAssetsAsync([assetFile]);
			}
			catch(error){
				this.setState({readingOrSavingObject: false});
				// Alerta: "Ocurrió un error al tratar de guardar este archivo"
				Alert.alert(this.props.allMessages[10], this.props.allMessages[32]);
			}
		}
		else {
			this.setState({readingOrSavingObject: false});
			// Alerta: "No tiene los permisos requeridos"
			Alert.alert(this.props.allMessages[10], this.props.allMessages[14]);	
		}
	} 

	// Se usa cuando queremos leer un afloramiento o núcleo que está almacenado en un archivo
	readObjectFromFile = async() => {
		const { status } = await ExpoMediaLibrary.requestPermissionsAsync();

		if (status === "granted") {
			try{
				const file = await ExpoDocumentPicker.getDocumentAsync();
				if (file.type === 'success'){
					this.setState({readingOrSavingObject: true});
					this.closeNewObjectModal();

					const fileContent = await ExpoFileSystem.readAsStringAsync(file.uri);
					const object      = JSON.parse(fileContent);

					// Condiciones que tiene que cumplirse para que el archivo sea válido, independientemente de si se trata de un afloramiento o un núcleo
					const commonConditions = object.hasOwnProperty('_id') && object.hasOwnProperty('name') && object.hasOwnProperty('locationInWords') &&
						object.hasOwnProperty('longitude') && object.hasOwnProperty('latitude') && object.hasOwnProperty('scale') &&
						object.hasOwnProperty('showInfo') && object.hasOwnProperty('showLithology') && object.hasOwnProperty('showStructure') &&
						object.hasOwnProperty('showFossils') && object.hasOwnProperty('showPictures') && object.hasOwnProperty('showNotes') &&
						object.hasOwnProperty('showCarbonatesRule') && object.hasOwnProperty('showNoCarbonatesRule') && object.hasOwnProperty('layerList') &&
						object.hasOwnProperty('numberOfItems') && object.hasOwnProperty('date') && object.hasOwnProperty('unit') &&
						object.hasOwnProperty('baseHeight');

					// Condiciones para que sea un afloramiento válido
					const outcropConditions = commonConditions && (!object.hasOwnProperty('gammaRayValues'));

					// Condiciones para que sea un núcleo válido
					const coreConditions = commonConditions && object.hasOwnProperty('showGammaRay') && object.hasOwnProperty('R') && object.hasOwnProperty('DF') &&
						object.hasOwnProperty('GL') && object.hasOwnProperty('TVD') && object.hasOwnProperty('TVDFromGL') && 
						object.hasOwnProperty('endHeight') && object.hasOwnProperty('gammaRayValues');

					if ((this.state.isCore && coreConditions) || (!this.state.isCore && outcropConditions)){

						// Necesitamos recuperar las imágenes de cada estrato
						let stratums        = object.layerList;
						var completeSuccess = true; // Determina si todas las imágenes pudieron ser cargadas exitosamente
						for (i = 0; i < stratums.length; i++){
							let stratum        = stratums[i]; // Estrato actual
							let listOfImages   = stratum.image_data.listOfImages; // Lista de imágenes del estrato actual

							if (listOfImages != null){
								var j = 0;
								let keysToDelete = [];
								for (j = 0; j < listOfImages.length; j++){
									let elem = listOfImages[j];
									try{
										// Esto crea una copia de la imagen en la caché del dispositivo, que es de la que obtendremos el base64, ya que no conozco
										// una manera directa de obtener el base64 a partir de la dirección original
										const assetImage = await ExpoMediaLibrary.createAssetAsync(elem.uri);

										// Obtenemos el base64 leyendo el contenido del archivo ubicado en assetImage.uri
										const base64 = await ExpoFileSystem.readAsStringAsync(assetImage.uri, {encoding: 'base64'});

										// Tenemos que crear un nuevo identificador para la imagen. No se puede continuar con el mismo porque si el objeto de estudio es borrado,
										// todos los documentos asociados a sus imágenes serán borrados también, y si varios objetos de estudio comparten las mismas imágenes borradas,
										// serán borradas de ellos también, lo cual probablemente no es lo que se desea.
										const key = auxiliarFunctions.generate_key();
										elem.key  = key;
										await Database.storeImage(base64, key, this.props.localDB);

										if (elem.isCover){
											stratum.image_data.keyImageToShow = key;
										}

										// Borramos la propiedad "uri" del objeto de imagen en el estrato, porque no nos interesa mantenerla
										delete elem.uri;

										// Tampoco nos interesa conservar la imagen de la caché
										ExpoMediaLibrary.deleteAssetsAsync([assetImage]);
									}
									catch(error){ // Caso en que la imagen no pudo ser encontrada
										completeSuccess = false;
										keysToDelete.push(elem.key)
									}
								}
								// Borramos las imágenes que no pudieron ser encontradas
								stratum.image_data.listOfImages = await listOfImages.filter(function(item){
									return !keysToDelete.includes(item.key)
								})
							}
						}
						// Cambiamos el _id por uno nuevo, para que nunca haya dos objetos de estudio con el mismo _id
						object._id = generateObject_id();
						
						// Los argumentos son: 1) payload; 2) isCore; 3) isNew=true; 4) user_id, 5) object_id, 6) localDB
						await Database.saveObjectOfStudyInfo(object, this.state.isCore, true, this.props.user_id, object._id, this.props.localDB);  
						this.loadObjects();
						
						if (completeSuccess){
							// Alerta: "El archivo fue cargado exitosamente"
							Alert.alert(this.props.allMessages[10], this.props.allMessages[15]);
						}
						else {
							// Alerta: "El archivo fue cargado, pero no se pudieron encontrar todas las imágenes"
							Alert.alert(this.props.allMessages[10], this.props.allMessages[16]);
						}
						this.setState({readingOrSavingObject: false});
					}
					else {
						// Alerta: "El archivo no se corresponde con un [núcleo/afloramiento]"
						Alert.alert(this.props.allMessages[10], this.props.allMessages[17](this.state.objectTypeMessage));
						this.closeNewObjectModal();
						this.setState({readingOrSavingObject: false});
					}
				}
				else if (file.type === 'cancel'){
				}
				else{
					// Alerta: "Ocurrió un error al tratar de leer el archivo"
					Alert.alert(this.props.allMessages[10], this.props.allMessages[18]);
					this.closeNewObjectModal();
					this.setState({readingOrSavingObject: false});
				}
			} catch(error){
				// Alerta: "Ocurrió un error al tratar de leer el archivo"
				Alert.alert(this.props.allMessages[10], this.props.allMessages[18]);
				this.closeNewObjectModal();
				this.setState({readingOrSavingObject: false});
			}
		} else {
			// Alerta: "No tiene los permisos requeridos"
			Alert.alert(this.props.allMessages[10], this.props.allMessages[14]);			
		}
	}

	// Eliminar el objeto seleccionado. 
	deleteObject () {
		let p = this.props;	

		// Procedimiento auxiliar que se invoca cuando se confirma que se desea eliminar
		let deleteObjectAux = () => {
			const id_to_delete = this.state.selectedObject._id;

			// Los argumentos son: 1) object_id; 2) isCore; 3) user_id; 4) localDB
			Database.deleteObjectOfStudy(id_to_delete, this.state.isCore, this.props.user_id, this.props.localDB);

			const list = this.state.renderList.filter(function(item){
				return item.key.toString() !== id_to_delete.toString()
			})
			this.setState({
				optionsModalVisible: false,
				renderList:  list,
			})
		}

		// Alerta: "¿Seguro de que desea eliminar el [núcleo/afloramiento]?"
		Alert.alert(p.allMessages[10], p.allMessages[19](this.state.objectTypeMessage),
			[
				// Mensaje: "Sí"
				{text: p.allMessages[20], onPress: () => deleteObjectAux()},
				// Mensaje: "No"
				{text: p.allMessages[21]},
			] 
		)
	}

	// Vista del modal de opciones, que se ve cuando el usuario deja presionado prolongadamente sobre un elemento
	optionsModalView(){
		let p = this.props;
		let s = this.state;

		return (
			<View>
				<Modal  
					animationType  = "slide"
					transparent    = {false}
					visible        = {this.state.optionsModalVisible}
					onRequestClose = {this.closeOptionsModal} // Esto permite cerrar el "modal" cuando se le da al botón de atrás
				> 
					<View style = {{flex: 0.9, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', marginTop: 30}}>

						<View style = {genericStyles.simple_center}> 
							<ButtonWithIcon // Botón para modificar la información del objeto que se proporcionó cuando se creó
								raised
								icon    = {{name: 'create'}}
								title   = {p.allMessages[22](s.objectTypeMessage)} // Mensaje: "Editar información de [núcleo/afloramiento]"
								onPress = {() => {this.editObjectInfo(s.selectedObject)}}
							/>
						</View>

						<View style = {genericStyles.simple_center}> 
							<ButtonWithIcon /// Botón para mostrar la localización del objeto en Google Maps, según la latitud y longitud registradas
								raised
								icon    = {{name: 'place'}}
								title   = {p.allMessages[23]} // Mensaje: "Ver localización en Google Maps"
								onPress = {() => {this.showLocationInGoogleMaps(s.selectedObject)}}
							/>
						</View>

						<View style = {genericStyles.simple_center}> 
							<ButtonWithIcon /// Botón para mostrar la localización del objeto en Google Earth, según la latitud, longitud y altitud registradas
								raised
								icon    = {<Icon  name="google-earth"  size={20}  color="black"/>}
								title   = {"  " + p.allMessages[24]} // Mensaje: "Ver localización en Google Earth"
								onPress = {() => {this.showLocationInGoogleEarth(s.selectedObject)}}
							/>
						</View>

						<View style = {genericStyles.simple_center}> 
							<ButtonWithIcon /// Botón para salvar el objeto en un archivo
								raised
								icon    = {{name: 'description'}}
								title   = {p.allMessages[25]} // Mensaje: "Salvar en archivo"
								onPress = {() => {this.saveObjectOnFile(s.selectedObject)}}
							/>
						</View>

						<View style = {{...genericStyles.simple_center, flex: 1.2}}>
							<ButtonNoIcon /// Botón para eliminar el objeto
								raised
								title   = {p.allMessages[26](s.objectTypeMessage)} // Mensaje: "Eliminar [núcleo/afloramiento]"
								color   = 'red'
								onPress = {() => this.deleteObject()}
							/>
						</View>
					</View>

					<View style = {{...genericStyles.simple_center, flex: 0.1, padding: 10}}>
						<ButtonNoIcon  // Botón para regresar a la lista de objetos, es decir, cerrar el este modal
							raised
							color   = {DARK_GRAY_COLOR}
							title   = {p.allMessages[27]} // Mensaje: "Volver"
							onPress = {this.closeOptionsModal}
						/>
					</View>

				</Modal>
			</View>
		)
	}

	/// Vista para decidir si el nuevo objeto se agrega desde archivo o si se rellenan los datos de uno completamente nuevo
	newObjectModalView(){
		let p = this.props;
		return (
			<View>
				<Modal  
					animationType     = "none"
					transparent       = {false}
					visible           = {this.state.newObjectModalVisible}
					onRequestClose    = {this.closeNewObjectModal} // Esto permite cerrar el "modal" cuando se le da al botón de atrás
				> 

					<View style = {{flex: 0.7, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', paddingTop: 100}}>

						<View style = {genericStyles.simple_center}> 
							<ButtonWithIcon
								raised
								icon    = {{name: 'create'}}
								title   = {p.allMessages[28]} // Mensaje: "Crear nuevo"
								onPress = {this.newObject}
							/>	
						</View>

						<View style = {genericStyles.simple_center}> 
							<ButtonWithIcon
								raised
								icon    = {{name: 'description'}}
								title   = {p.allMessages[29]} /// Mensaje: "Agregar desde archivo"
								onPress = {this.readObjectFromFile}
							/>	
						</View>

					</View>

					<View style = {{flex: 0.3, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', paddingBottom: 100}}>
						<ButtonNoIcon
							raised
							color   = {DARK_GRAY_COLOR}
							title   = {p.allMessages[27]} // Mensaje: "Volver"
							onPress = {this.closeNewObjectModal}
						/>				
					</View>
				</Modal>
			</View>
		)
	}

	/// Sirve para activar la función que lee desde la base de datos. Esto es útil cuando estamos emulando la aplicación y refrescamos la página
	// en caliente, ya que hacer eso volverá a colocar this.state.loading en su valor inicial (true) pero este componente ya estará montado, por lo que 
	// no se activará el NavigationEvents onWillFocus, y en consecuencia la vista se quedará pegada en "Cargando"
	activateLoadObjects(){
		if (this.state.loadFunctionOpened){
			this.setState({loadFunctionOpened: false});
			this.loadObjects();
		}
		return(<View/>)
	}

	// Lo que se le mostrará al usuario
	render (){
		let p = this.props;

		if (this.state.loading || this.state.readingOrSavingObject){
			return (
				<View style = {genericStyles.simple_center}>
					{this.state.loading && this.activateLoadObjects()}
					<ActivityIndicator size = "large" color = "#0000ff" />
					{/*Mensaje: "Cargando"*/}
					<Text>{p.allMessages[30]}...</Text>
				</View>
			);	
		} 

		// Vista para cuando ya se cargaron los objetos desde la base de datos
		return (
			<View style = {genericStyles.lightGray_background}>
				<NavigationEvents onWillFocus = {payload => this.loadObjects()}/>

				{/*Modales*/}
				{this.optionsModalView()}
				{this.newObjectModalView()}

				{/*Vista de los afloramientos o núcleos creados*/}
				<View style = {{flex: 0.9, flexDirection: 'row'}}>
					<ScrollView keyboardShouldPersistTaps = 'handled'>
						{this.state.renderList}
					</ScrollView>      	
				</View>

				{/*Vista del botón para agregar un nuevo afloramiento o núcleo*/}
				<View style = {genericStyles.down_buttons}>
					<ButtonWithIcon
						raised
						icon     = {{name: 'playlist-add'}}
						title    = {p.allMessages[31](this.state.objectTypeMessage)} // Mensaje: "Agregar [núcleo/afloramiento]"
						onPress  = {this.state.modalsEnabled ? () => {this.showNewObjectModal()} : () => {}}
					/>
				</View>
			</View>
		);
	}
}

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages: ObjectGallery_Texts[state.appPreferencesReducer.language], 
		user_id:     state.userReducer.user_id,
		localDB:     state.userReducer.localDB,
	}
};

export default connect(mapStateToProps)(ObjectGallery);