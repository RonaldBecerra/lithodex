import React, { Component } from 'react'
import { Text, Button, Image, View, ScrollView, Alert,
		 TouchableHighlight, StyleSheet, Modal, Keyboard,
		 ActivityIndicator, Button as ButtonNoIcon, TextInput } from 'react-native'

import { CheckBox, Button as ButtonWithIcon} from "react-native-elements"

import ImageZoom from 'react-native-image-pan-zoom'
import * as ExpoImagePicker from 'expo-image-picker'
import * as Permissions     from 'expo-permissions'
import * as ExpoFileSystem  from 'expo-file-system'

import { connect } from 'react-redux'
import { changeStratumComponentPermission } from '../redux/actions/popUpActions'
import { ImagePicker_Texts } from '../languages/components/ImagePicker'

import * as Log       from '../genericFunctions/logFunctions'
import * as Database  from '../genericFunctions/databaseFunctions'
import * as auxiliarFunctions from '../genericFunctions/otherFunctions'
import { genericStyles, DARK_GRAY_COLOR } from '../constants/genericStyles'
import * as D         from '../constants/Dimensions'
import { URI_PREFIX } from '../constants/appConstants'

import _ from "lodash"


class ImagePicker extends Component {

	constructor(props){
		super(props)
		this.keyboardDidShow = this.keyboardDidShow.bind(this)
		this.keyboardDidHide = this.keyboardDidHide.bind(this)

		this.state = {
			// Clave de la imagen que se muestra en el ObjectScreen
			keyImageToShow: (this.props.data.keyImageToShow == null) ? null : this.props.data.keyImageToShow,

			// Dirección de la imagen que se muestra en el ObjectScreen, que se obtiene desde la base de datos usando la clave "keyImageToShow"
			uriImageToShow: null,

			// Lista de imágenes que han sido salvadas. Esta lista es la que se guarda en la base de datos en el documento de este objeto de estudio
			// (afloramiento o núcleo) y omite la propiedad "uri", ya que ella se almacena en un documento aparte
			listOfImages: (this.props.data.listOfImages == null) ? [] : this.props.data.listOfImages,

			// Esta lista la creamos cada vez que entramos en esta vista de fotografías. Es similar a "listOfImages" pero incluye la propiedad "uri"
			listOfImages_withUri: [],

			// Matriz que guarda las mismas imágenes que "listOfImages", pero las separa en filas de 2 imágenes.
			matrixOfImages: null,

			// Igual que "matrixOfImages", pero incluyendo la interfaz gráfica que muestra las imágenes
			renderMatrix: null, 

			// ------- Variables que determinan si se muestran los modales
			modal_1_visible: false, // Menú en donde se puede capturar una nueva imagen, o ir a la vista de las ya tomadas.
			modal_2_visible: false, // Aquí se visualizan todas las imágenes tomadas
			modal_3_visible: false, // Aquí se modifica la descripción de una imagen, y además se puede eliminar dicha imagen
			modal_4_visible: false, // Aquí se visualiza una imagen específica completa, con sus dimensiones originales 

			// Llamamos current Image a la imagen que un usuario seleccionó para visualizarla, cambiarle su descripción, establecerla como portada, o eliminarla
			currentImageToEdit:        null, // Objeto con las características de la imagen
			currentImageToEdit_width:  null, // Anchura original de la imagen
			currentImageToEdit_height: null, // Altura original de la imagen
			currentImageProvText:      null, // Texto descriptivo de la imagen, pero no se guardará en la base de datos hasta que el usuario acepte los cambios
			currentImageProvIsCover:   null, // Booleano que indica si la imagen actual es portada (la que se muestra en el Object Screen), aunque tampoco se guardará en la
			                                 // base de datos hasta que el usuario acepte los cambios

			imageDimensions_ObjectScreen: 0.42 * D.GLOBAL_SCREEN_WIDTH, // Dimensiones con las que se mostrarán las imágenes en la ventana externa (ObjectScreen)
			componentKey: this.props.stratum_key + '_image', // Para que se sepa qué parte del estrato se va a salvar

			loading: false, // Determina si se está cargando una nueva imagen, ya sea desde la galería, o una nueva fotografía que el usuario acaba de capturar, o si se están
			                // salvando cambios de una imagen ya creada
			creatingRenderMatrix: false, // Determina si se está creando la matriz de todas las imágenes añadidas al estrato actual

			// Determina si el teclado está visible. Esto lo pusimos porque no queremos que los botones de "Aceptar" y "Cancelar" cierren la vista cuando el teclado está visible
			keyboardAvailable: false,

			// Determina si el usuario puede presionar algún botón, evitando que lo haga dos veces seguidas antes de que culmine un proceso
			buttonsEnabled: true,
		}
	}

	async componentDidMount(){
		/* Si no colocáramos esto, si el programador refresca esta página estando dentro de ella en la aplicación, se regresará a la 
		   ventana externa sin haber vuelto a habilitar el permiso de poder ingresar a los componentes. Antes lo habilitábamos una sola vez
		   en la ventana externa, pero ahora en todos los componentes */
		this.props.dispatchEnteringPermission(true);

		this.loadCoverImage();

		// Aquí inicializamos los escuchas que determinan si el teclado se está mostrando o no
		this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow);
		this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide);
	}

	// Procedimiento que carga la imagen portada desde la base de datos, que es la que se muestra en la ventana externa (ObjectScreen)
	async loadCoverImage(){
		if (this.state.keyImageToShow !== null){
			let uriImageToShow = null;

			await this.props.localDB.get(this.state.keyImageToShow)
				.then(async function(document){
					uriImageToShow = await URI_PREFIX + document.base64;
				})
				.catch(error => {
					this.deleteMissingImages(false);
					if (error.name !== 'not_found'){
						console.error(error.toString())
					} 
				})
			this.setState({uriImageToShow});
		}
	}

	// Caso en que el teclado se está mostrando
	keyboardDidShow() {
		this.setState({keyboardAvailable: true});
	}

	// Caso en que el teclado se ocultó
	keyboardDidHide() {
		this.setState({keyboardAvailable: false});
	}

	// Procedimiento para salvar los cambios realizados en la base de datos del usuario
	async saveInDatabase(payload, newImage=null, base64=null){
		let p = this.props;
		let noErrors = true;

		if (newImage !== null){
			//Caso en que estamos salvando una nueva imagen
			try {
				noErrors = await Database.storeImage(base64, newImage.key, p.localDB);
			} catch(e){
				noErrors = false;
				this.setState({loading: false})
			}
		}
		if (noErrors){
			try{
				noErrors = await Database.saveStratumModule(p.user_id, p.Object_id, p.index, this.state.componentKey, payload, p.isCore, p.localDB);
				this.setState({loading: false})
			} catch(e) {
				noErrors = false;
				this.setState({loading: false})
			}
		}
		return noErrors;
	}

	// Procedimiento para borrar las imágenes cuyo documento correspondiente ya no se encuentra en la base de datos
	// El booleano "createListWithUri" indica si después de hacer la eliminación (o eliminaciones) debe crearse la lista
	// this.state.listOfImages_withUri
	async deleteMissingImages(createListWithUri){
		let s = this.state;
		let p = this.props;

		let coverDeleted = false;
		let keysToDelete = [];

		for (i=0; i < s.listOfImages.length; i++){
			let elem = s.listOfImages[i];

			await p.localDB.get(elem.key)
				.catch((error) =>{
					keysToDelete.push(elem.key);
					if (elem.isCover){
						coverDeleted = true;
					}
					if (error.name !== 'not_found'){
						console.error(error.toString())
					} 
				})
		}

		// Creamos la lista de objetos de imagen que no incluye los que fueron eliminados
		let listOfImages_noUri = await s.listOfImages.filter(function(item){
			return !keysToDelete.includes(item.key)
		})

		// Caso en que la portada fue removida
		if (coverDeleted){
			// Si todavía hay elementos en la lista, hacemos que la portada sea el primero
			if (listOfImages_noUri.length > 0){

				let uriImageToShow = null;
				await p.localDB.get(listOfImages_noUri[0].key)
					.then(async function(document){
						uriImageToShow = await URI_PREFIX + document.base64;
					})
				listOfImages_noUri[0].isCover = true;;

				this.setState({uriImageToShow, keyImageToShow: listOfImages_noUri[0].key})
			}
			else{
				this.setState({keyImageToShow: null, uriImageToShow: null})
			}

		}

		this.setState({listOfImages: listOfImages_noUri}, () => {
			if (createListWithUri){
				this.createListOfImages_withUri();
			}
		})
	}

	/* Procedimiento para crear la lista de imágenes en la que cada elemento es un objeto con las propiedades de la imagen, incluyendo la dirección "uri".
	   Esta lista sólo se mantiene en memoria mientras estemos en esta vista; no se guarda en la base de datos */
	async createListOfImages_withUri(){
		let s = this.state;
		let p = this.props;

		var listOfImages_withUri = [];
		let uri = null;
		let noErrors = true;
		const len = s.listOfImages.length;

		for (i = 0; i < len; i++){
			let elem = s.listOfImages[i];
			await p.localDB.get(elem.key)
				.then(async function(document){
					uri = await URI_PREFIX + document.base64;
				})
				.catch(function(error){
					noErrors = false;
				})
			listOfImages_withUri.push({...elem, uri})
			if (!noErrors){
				break;
			}
		}

		if (noErrors){
			this.setState({listOfImages_withUri}, () => {this.create_matrixOfImages()});
		} else {
			this.deleteMissingImages(true);
		}
	}

	// Procedimiento para crear la matriz de dos columnas que contiene todas las imágenes añadidas
	async create_matrixOfImages(){
		let s = this.state;
		const len = s.listOfImages_withUri.length;
		
		if (len > 0){
			var matrixOfImages = [];
			const numberRows = Math.ceil(len/2);

			for (i = 0; i < numberRows; i++){
				var newRow = [];
				var i1 = i << 1; // left shift 1 -> es lo mismo que multiplicar por 2
				var i2 = i1 + 1;

				newRow.push(s.listOfImages_withUri[i1]);
				if (i2 < len) {
					newRow.push(s.listOfImages_withUri[i2]);
				}
				matrixOfImages.push(newRow);
			}
			await this.setState({matrixOfImages}, () => {this.create_RenderMatrix()});
		}
		else {
			await this.setState({matrixOfImages: [[]], creatingRenderMatrix: false});
		}
	}

	// Procedimiento para crear una matriz como la de la función de arriba, pero además las muestra como vistas que se pueden renderizar
	async create_RenderMatrix(){
		let s = this.state;

		await this.setState({
			renderMatrix: s.matrixOfImages.map((rowOfImages, i) => (
				<View style={{flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 10, paddingBottom: 10}}  key={i} >
					{rowOfImages.map((item, k) => (
						<View style={{width: s.imageDimensions_ObjectScreen, height: s.imageDimensions_ObjectScreen, opacity: 1}}  key={k}>
							<TouchableHighlight  
								onPress     = {this.state.buttonsEnabled ? () => {this.showModal_3(item)} : () => {}}
								onLongPress = {this.state.buttonsEnabled ? () => {this.showModal_3(item)} : () => {}}
								style       = {{flex: 1}}
							>
								<Image 
									source = {{uri: item.uri}}
									style  = {{flex: 1}}
								/>
							</TouchableHighlight>
						</View>
					))}
				</View>
			))
		})
		/// Indicamos que ya terminamos de crear la matriz de imágenes
		this.setState({creatingRenderMatrix: false});
	} 

	// ---------------------- Los siguientes procedimientos muestran u ocultan los modales respectivos -------------------------
	showModal_1 = () => {
		let p = this.props;
		if (this.props.enteringEnabled){
			p.dispatchEnteringPermission(false);
			this.setState({modal_1_visible: true});
			
			if (p.data.listOfImages != null) {
				this.setState({creatingRenderMatrix: true});
				Log.log_action({entry_code: 23, user_id: p.user_id, isCore: p.isCore, object_id: p.Object_id, stratum_key: p.stratum_key});
				this.createListOfImages_withUri();
			}
			else {	
				Log.log_action({entry_code: 22, user_id: p.user_id, isCore: p.isCore, object_id: p.Object_id, stratum_key: p.stratum_key});
			}
		}
	}

	hideModal_1 = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});
			this.props.dispatchEnteringPermission(true);
			this.setState({modal_1_visible: false}, () => this.setState({buttonsEnabled: true}));
		}
	}

	// Procedimiento para mostrar u ocultar el segundo modal, que es en donde se muestra la matriz de todas las imágenes añadidas en el estrato
	setModal_2_Visible = (isVisible) => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {
				this.setState({modal_2_visible: isVisible}, () => this.setState({buttonsEnabled: true}));
			})	
		}	
	}

	// Procedimiento para mostrar el tercer modal. Aquí la puede cambiar la descripción de la imagen, y se puede eliminar
	showModal_3 = (item) => {
		this.setState({buttonsEnabled: false}, () => {
			Image.getSize(item.uri, (width, height) => {
				this.setState({
					modal_3_visible:           true,
					currentImageToEdit:        item,
					currentImageToEdit_width:  width, 
					currentImageToEdit_height: height,
					currentImageProvIsCover:   item.isCover,
					currentImageProvText:      item.description,
				}, () => {
					this.setState({buttonsEnabled: true})
				})
			});
		})
	}

	// Procedimento para ocultar el tercer modal.
	hideModal_3 = async() => {
		this.setState({
			modal_3_visible:          false,
			currentImageToEdit:        null, 
			currentImageToEdit_width:  null,
			currentImageToEdit_height: null,
			currentImageProvIsCover:   null,
			currentImageProvText:      null,
			buttonsEnabled:            true,
		});
	}

	// Procedimiento para mostrar u ocultar el cuarto modal, que es en donde se muestra la imagen con sus
	// dimensiones originales y se le puede hacer zoom
	setModal_4_Visible = (isVisible) => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {
				this.setState({modal_4_visible: isVisible}, () => this.setState({buttonsEnabled: true}));
			})	
		}	
	}

	// Procedimiento para acceder a la galería de imágenes (o desde cualquier otro directorio) y poder escoger de allí una imagen
	selectPictureFromGallery = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, async() => {
				const {status} = await Permissions.askAsync(Permissions.CAMERA_ROLL);

				if (status !== 'granted'){
					// Alerta: "No tiene permiso para acceder a la galería"
					Alert.alert(this.props.allMessages[13], this.props.allMessages[11]);
				}
				else {
					const { cancelled, uri, base64 } = await ExpoImagePicker.launchImageLibraryAsync({allowsEditing: true, base64: true});

					// Caso en que el usuario sí seleccionó una imagen en la galería
					if(!cancelled) { 
						// Borramos la imagen que se crea en la caché para sólo quedarnos con la "base64", que es la que podemos almacenar en la base de datos
						ExpoFileSystem.deleteAsync(uri);
						this.saveNewImage(base64);
					} 		
				}
				this.setState({buttonsEnabled: true});
			})
		}
	}

	// Procedimiento para poder tomar una nueva foto con la cámara del dispositivo móvil
	takePicture = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, async() => {
				const {status} = await Permissions.askAsync(Permissions.CAMERA);

				if (status !== 'granted'){
					// Alerta: "No tiene permiso para acceder a la cámara"
					Alert.alert(this.props.allMessages[13], this.props.allMessages[12]);
				}
				else {
					// Haciendo pruebas se obtuvo que con calidad máxima el documento de imagen luego no pede ser encontrado. Por eso la bajamos a 0.99
					const { cancelled, uri, base64 } = await ExpoImagePicker.launchCameraAsync({allowsEditing: true, base64: true, quality: 0.99});

					// Caso en que el usuario sí capturó una fotografía
					if(!cancelled) {
						// Borramos la imagen que se crea en la caché para sólo quedarnos con la "base64", que es la que podemos almacenar en la base de datos
						ExpoFileSystem.deleteAsync(uri);
						this.saveNewImage(base64);
					}
				}
				this.setState({buttonsEnabled: true});
			})
		}
	}

	// Esta función se llama cada vez que se crea una nueva imagen, independientemente de si se escogió de la galería o fue una captura
	saveNewImage = async(base64) => {
		this.setState({loading: true});

		let s = this.state;
		let p = this.props;
		var isCover = false; // Booleano que indica si ésta es la imagen que se mostrará en la parte externa (ObjectScreen) o no
		var uriImageToShow = s.uriImageToShow;
		var keyImageToShow = s.keyImageToShow;

		const key = auxiliarFunctions.generate_key(); // Identificador de la imagen que se está creando
		const noElems = (s.listOfImages.length == 0); // Determina si no había elemento previos guardados
		const uri = URI_PREFIX + base64; // Cadena que puede ser interpretada como imagen en los componentes de imagen

		// Si no había elementos en la lista de imágenes, la imagen que se mostrará en la ventana externa será la que se acaba de crear
		if (noElems){
			keyImageToShow = key;
			isCover = true;
		}

		// Creamos el objeto que tiene el identificador de la nueva imagen, su descripción y el booleano "isCover"
		var newImage = {key, description: "", isCover}; 

		let provList = await _.cloneDeep(s.listOfImages);
		await provList.push(newImage)

		// Almacenamos la información necesaria en la base de datos
		var payload = await {
			listOfImages: provList, 
			keyImageToShow,
		};
		let saveSuccesful = await this.saveInDatabase(payload, newImage, base64);

		// Sólo si el guardado fue exitoso en la base de datos es que actualizamos las variables de estado
		if (saveSuccesful){
			// Alerta: "La imagen fue agregada exitosamente"
			Alert.alert(p.allMessages[13], p.allMessages[17]);

			this.setState({creatingRenderMatrix: true})
			if (noElems){
				this.setState({uriImageToShow: uri, keyImageToShow});
			}
			await s.listOfImages.push(newImage); // Insertamos el objeto en la lista de imágenes guardadas
			await s.listOfImages_withUri.push({...newImage, uri}) // También lo insertamos en la copia de esa lista que tiene las uri's
			this.create_matrixOfImages();
		}
		else {
			// Alerta: "Error: La imagen no pudo ser agregada"
			Alert.alert(p.allMessages[13], p.allMessages[18]);
		}
	}

	acceptImageSettings = async() => {
		this.setState({buttonsEnabled: false})

		let s = this.state;
		let cImage_withUri = s.currentImageToEdit; // Objeto con las propiedades de la imagen que se está analizando, que incluye la dirección "uri"

		const isCoverChanged = (cImage_withUri.isCover !== s.currentImageProvIsCover); // Determina si el usuario cambió el hecho de si esta imagen es portada o no
		const textChanged    = (cImage_withUri.description !== s.currentImageProvText); // Determina si el usuario cambió el texto descriptivo de la imagen

		if ( isCoverChanged || textChanged ){

			// Encontramos el índice de la imagen que estamos editando, que debe ser el mismo en las dos listas:
			// la de los objetos que incluyen "uri" y la de los que no lo incluyen
			const currentIndex = s.listOfImages.findIndex(image => image.key === cImage_withUri.key);
			
			let cImage_noUri   = s.listOfImages[currentIndex];

			// Si el texto cambió, lo actualizamos
			if (textChanged){
				cImage_noUri.description = cImage_withUri.description = s.currentImageProvText;
			}

			// Caso en que cambió el hecho de si esta imagen es portada o no
			if (isCoverChanged){

				// Caso en que el cuadro fue desmarcado
				if (cImage_withUri.isCover && !s.currentImageProvIsCover){
					let indexNewCover;

					/* La imagen que ahora será portada debe ser la primera de la lista, pero si la que estamos desmarcando es la primera
					   de la lista, entonces la portada debe ser la segunda */
					(currentIndex == 0) ? (indexNewCover = 1) : (indexNewCover = 0);
					s.listOfImages[indexNewCover].isCover = true; // Actualizamos la información en la lista de los que no tienen "uri"

					newCover = s.listOfImages_withUri[indexNewCover];
					newCover.isCover = true; // Actualizamos la información en la lista de los que sí tienen "uri"

					this.setState({uriImageToShow: newCover.uri, keyImageToShow: newCover.key});
				}
				else // Caso en que el cuadro fue marcado
				{ 
					// Tenemos que hacer que el campo "isCover" de la imagen que antes era portada ahora sea falso
					const indexPreviousCover = s.listOfImages.findIndex(element => element.isCover === true);
					s.listOfImages[indexPreviousCover].isCover = s.listOfImages_withUri[indexPreviousCover].isCover = false;
					cImage_withUri.isCover = cImage_noUri.isCover = true;

					this.setState({uriImageToShow: cImage_withUri.uri, keyImageToShow: cImage_withUri.key});
				}
			}

			this.setState({loading: true});
			this.hideModal_3();

			// Almacenamos la información necesaria en la base de datos
			var payload = {
				listOfImages:   s.listOfImages, 
				keyImageToShow: cImage_noUri.key,
			};
			await this.saveInDatabase(payload);
		}
		else {
			this.hideModal_3();
		}
	}

	// Procedimiento para borrar una imagen
	deleteCurrentImage(){
		let p = this.props;	

		// Procedimiento auxiliar que se invoca cuando se confirma que se desea eliminar la imagen
		let deleteImageAux = async(p) => {
			this.setState({buttonsEnabled: false});

			let s = this.state;
			let cImage_withUri = s.currentImageToEdit;

			// Encontramos el índice de la imagen que estamos editando, que debe ser el mismo en las dos listas:
			// la de los objetos que incluyen "uri" y la de los que no lo incluyen
			const currentIndex = await s.listOfImages.findIndex(image => image.key === cImage_withUri.key);

			let cImage_noUri = s.listOfImages[currentIndex];

			// Borramos el documento de la imagen de la base de datos
			Database.deleteImage(cImage_noUri.key, p.localDB);

			const wasCover = cImage_noUri.isCover;
			var currentCoverUri = s.uriImageToShow;
			var currentCoverKey = s.keyImageToShow;

			// Eliminamos el elemento correspondiente en las dos listas
			await s.listOfImages.splice(currentIndex, 1);
			await s.listOfImages_withUri.splice(currentIndex,1);

			// Caso en que la imagen eliminada era la portada
			if (wasCover){
				// Caso en que no quedan otros elementos en la lista
				if (0 == s.listOfImages.length){
					currentCoverUri = null;
					currentCoverKey = null;
				}
				else // Caso en que sí quedan otros elementos. La portada será el primero de dicha lista.
				{
					let elem = s.listOfImages_withUri[0];
					elem.isCover    = true;
					currentCoverUri = elem.uri;
					currentCoverKey = elem.key;

					s.listOfImages[0].isCover = true;
				}
			}

			await this.setState({
				loading:              true,
				creatingRenderMatrix: true,
				uriImageToShow:       currentCoverUri,
				keyImageToShow:       currentCoverKey,

			}, () => {
				this.hideModal_3();
				this.create_matrixOfImages();
			});

			// Almacenamos la información necesaria en la base de datos
			const payload = {
				listOfImages:   s.listOfImages, 
				keyImageToShow: currentCoverKey,
			};
			this.saveInDatabase(payload);		
		}

		// Alerta: "¿Seguro de que desea eliminar la imagen?"
		Alert.alert(p.allMessages[13], p.allMessages[14],
			[
				// Mensaje: "Sí"
				{text: p.allMessages[15], onPress: () => deleteImageAux(p)},
				// Mensaje: "No"
				{text: p.allMessages[16]},
			] 
		)
	}

	// Lo que se muestra cuando el usuario ingresa en el menú de selección de fotografía
	modal_1_View(){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {false}
					visible        = {this.state.modal_1_visible}
					onRequestClose = {() => this.hideModal_1()}
				>
					<View style = {genericStyles.lightGray_background}>

						{/*Cabecera de la pantalla que dice el nombre del estrato que se está modificando*/}
						<View style = {genericStyles.modalHeader}>
							{/* Mensaje: "Imágenes del estrato"*/}
							<Text style = {{justifyContent: 'center', alignItems: 'center', fontSize: 17, fontWeight: 'bold'}}>
								{p.allMessages[0]}: {p.stratumName}
							</Text>
						</View>

						{this.state.loading && // Caso en que esperamos a que se añada una nueva imagen
							<View style = {genericStyles.white_background_without_ScrollView}>
								<View style = {genericStyles.simple_center}>
									<ActivityIndicator size = "large" color = "#0000ff" />
									{/*Mensaje: "Cargando"*/}
									<Text>{p.allMessages[19]}...</Text>
								</View>
							</View>
						}

						{!this.state.loading && ///Botones para agregar nuevas imágenes o ver las imágenes ya añadidas
							<View style = {genericStyles.white_background_with_ScrollView}>
								<ScrollView>

									<View style = {localStyles.buttonView}> 
										<ButtonWithIcon  // Botón para añadir una imagen desde archivo
											raised
											title   = {p.allMessages[1]} // Mensaje: "Agregar desde galería"
											onPress = {this.selectPictureFromGallery}
											icon    = {{name: 'add-to-photos'}}
										/>
									</View>

									<View style = {localStyles.buttonView}> 
										<ButtonWithIcon  ///Botón para capturar una fotografía
											raised
											title   = {p.allMessages[2]} // Mensaje: "Tomar nueva foto"
											onPress = {this.takePicture}
											icon    = {{name: 'add-a-photo'}}
										/>
									</View>

									<View style = {localStyles.buttonView}>
										<ButtonWithIcon  /// Botón para ir a la galería de todas las imágenes añadidas a este estrato
											raised
											title   = {p.allMessages[3]} // Mensaje: "Ver imágenes añadidas"
											onPress = {s.buttonsEnabled ? () => {this.setModal_2_Visible(true)} : () => {}}
											icon    = {{name: 'collections'}}
										/>
									</View>

								</ScrollView>
							</View>
						}
						{/*//Botón para volver al ObjectScreen */}
						<View style = {genericStyles.down_buttons}>
							<ButtonNoIcon
								raised
								color   = {DARK_GRAY_COLOR}
								title   = {p.allMessages[4]} // Mensaje: "Volver"
								onPress = {() => this.hideModal_1()}
							/>
						</View>
					</View>
				</Modal>
			</View>
		)
	}

	// Aquí se muestran todas las imágenes añadidas
	modal_2_View(){
		let s = this.state;
		let p = this.props;
		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {false}
					visible        = {this.state.modal_2_visible}
					onRequestClose = {this.state.buttonsEnabled ? () => {this.setModal_2_Visible(false)} : () => {}}
				>
					{/*Cabecera de la pantalla que dice el nombre del estrato que se está modificando*/}
					<View style = {genericStyles.modalHeader}>
						{/* Mensaje: "Imágenes del estrato"*/}
						<Text style = {{justifyContent: 'center', alignItems: 'center', fontSize: 17, fontWeight: 'bold'}}>
							{p.allMessages[0]}: {p.stratumName}
						</Text>
					</View>

					<View style = {genericStyles.lightGray_background}>

						{(s.creatingRenderMatrix || s.loading) && // Caso en que esperamos a que se cree la matriz de imágenes o a que se salven los cambios de una imagen
							<View style = {genericStyles.white_background_without_ScrollView}>
								<View style = {genericStyles.simple_center}>
									<ActivityIndicator size = "large" color = "#0000ff" />
									{/*Mensaje: "Cargando"*/}
									<Text>{p.allMessages[19]}...</Text>
								</View>
							</View>
						}

						{!this.state.creatingRenderMatrix && !s.loading && /// Caso en que se puede mostrar la matriz de imágenes
							<View style = {genericStyles.white_background_with_ScrollView}>
								{(s.listOfImages.length == 0) &&
									<View style = {{flex: 1, flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center'}}>
										{/*Mensaje: "No se han añadido imágenes"*/}
										<Text style = {{textAlign: 'center'}}>{p.allMessages[5]}</Text>
									</View>
								}
								{(s.listOfImages.length != 0) &&
									<ScrollView>
										{s.renderMatrix}
									</ScrollView>
								}
							</View>
						}

						{/* Botón para regresar a la vista anterior */}
						<View style = {genericStyles.down_buttons}>
							<ButtonNoIcon
								raised
								color   = {DARK_GRAY_COLOR}
								title   = {p.allMessages[4]} // Mensaje: "Volver"
								onPress = {s.buttonsEnabled ? () => {this.setModal_2_Visible(false)} : () => {}}
							/>
						</View>
					</View>
				</Modal>
			</View>
		)
	}

	// Ventana para visualizar la descripción de una imagen específica, el cuadro de confirmación para posiblemente establecerla como
    // portada, y el botón para eliminarla 
	modal_3_View(){
		let s = this.state;
		let p = this.props;
		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {false}
					visible        = {this.state.modal_3_visible}
					onRequestClose = {() => this.hideModal_3()}
				>
					<View style = {genericStyles.lightGray_background}>

						{(s.currentImageToEdit != null) && 

							< //Aquí están todos los elementos de la vista menos los botones de Aceptar y Cancelar
							View style = {genericStyles.white_background_with_ScrollView}>
								<ScrollView>	

									<View style = {{justifyContent: 'center', alignItems: 'center', paddingTop: 20}}>
										<TouchableHighlight 
											onPress     = {() => {this.setModal_4_Visible(true)}}
											onLongPress = {() => {this.setModal_4_Visible(true)}} 
											style       = {localStyles.touchableHighlight_NoBorder}
										>
											<Image 
												resizeMethod = "auto"
												source       = {{ uri: s.currentImageToEdit.uri }}
												style        = {localStyles.touchableHighlight_WithBorder}
											/>
										</TouchableHighlight>
									</View>	

									{/*Mensaje: "Descripción de imagen*/}
									<Text style = {{...genericStyles.subtitle, paddingTop: 20}}>{p.allMessages[6]}</Text>

									<View style = {{flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}> 
										
										{/*//Aquí se rellena la descripción de la imagen*/}
										<TextInput  
											style = {{ 
												height:         0.13 * D.GLOBAL_SCREEN_HEIGHT, 
												width:          0.8 * D.GLOBAL_SCREEN_WIDTH, 
												borderColor:    'black', 
												borderWidth:    1, 
												padding:        5,
												textAlign:      'center'
											}}
											onChangeText      = {text => this.setState({currentImageProvText: text})}
											multiline         = {true}
											selectTextOnFocus = {true}
											value             = {this.state.currentImageProvText}
										/>	

									</View>	

									{(s.listOfImages.length > 1) &&
										<View>
											{/*//Mensaje: "Establecer como imagen predeterminada del estrato"*/}
											<Text style = {{...genericStyles.subtitle, paddingTop: 20}}>{p.allMessages[7]}</Text>

											<CheckBox /// Cuadro para seleccionar si ésta será la imagen que se muestra en la ventana externa
												title   = {p.allMessages[8]} // Mensaje: "Es imagen predeterminada"
												checked = {this.state.currentImageProvIsCover}
												onPress = {() => {this.setState({currentImageProvIsCover: !this.state.currentImageProvIsCover})}}
											/>
										</View>
									}

									<View style = {{flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingTop: 40, paddingBottom: 30}}> 							
										<ButtonNoIcon
											raised
											color   = 'red'
											title   = {p.allMessages[9]} /// Mensaje: "Eliminar imagen"
											onPress = {this.state.buttonsEnabled ? () => {this.deleteCurrentImage()} : () => {}}
										/>
									</View>	

								</ScrollView>
							</View>
						}

						{/*//Vista de los botones para darle Aceptar o Cancelar*/}
						<View style = {genericStyles.down_buttons}>

							<View style = {{paddingRight: 25}}>
								<ButtonNoIcon 
									raised
									title   = {p.allMessages[20]} /// Mensaje: "Cancelar"
									color   = {DARK_GRAY_COLOR}
									onPress = {this.state.buttonsEnabled ? () => {s.keyboardAvailable ? Keyboard.dismiss() : this.hideModal_3()} : () => {}}
								/>
							</View>

							<View style = {{paddingLeft: 25}}>
								<ButtonWithIcon
									raised
									title   = {p.allMessages[21]}  /// Mensaje: "Aceptar"
									icon    = {{name: 'check'}}
									onPress = {this.state.buttonsEnabled ? () => {s.keyboardAvailable ? Keyboard.dismiss() : this.acceptImageSettings()} : () => {}}
								/>
							</View>

						</View>
					</View>
				</Modal>
			</View>
		)
	}

	/// Ventana para visualizar una imagen específica con sus dimensiones originales, y además se le puede hacer zoom
	modal_4_View(){
		let s = this.state;
		let p = this.props;
		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {false}
					visible        = {this.state.modal_4_visible}
					onRequestClose = {() => this.setModal_4_Visible(false)}
				>
					<View style = {genericStyles.lightGray_background}>

						{(s.currentImageToEdit != null) && 

							< // Aquí están todos los elementos de la vista menos el botón para volver
							View style = {genericStyles.white_background_with_ScrollView}>
								{/*Imagen mostrada*/}
								<View style = {localStyles.imageView}>
									<ImageZoom 
										cropWidth   = {0.9 * D.GLOBAL_SCREEN_WIDTH}  // Ancho del área operativa
										cropHeight  = {0.8 * D.GLOBAL_SCREEN_HEIGHT} // Alto del área operativa
										imageWidth  = {s.currentImageToEdit_width} // Ancho de la imagen a mostrar
										imageHeight = {s.currentImageToEdit_height} // Alto de la imagen a mostrar
										enableCenterFocus = {false} // Si se deja esto en "true", siempre se enfoca el centro de la imagen
										minScale    = {1/100}
									>
										<Image 
											source = {{uri: s.currentImageToEdit.uri}}
											style  = {{width: s.currentImageToEdit_width, height: s.currentImageToEdit_height}}
										/>
									</ImageZoom> 
								</View>
							</View>
						}

						{/*// Botón para regresar a la vista anterior */}
						<View style = {genericStyles.down_buttons}>
							<ButtonNoIcon
								raised
								color   = {DARK_GRAY_COLOR}
								title   = {p.allMessages[4]} // Mensaje: "Volver"
								onPress = {() => this.setModal_4_Visible(false)}
							/>
						</View>
					</View>
				</Modal>
			</View>
		)
	}

	// Todo lo que se le mostrará al usuario
	render(){
		let s = this.state;
		let p = this.props;

		let length = s.listOfImages.length;

		return (
			<View>
				{/*Modales*/}
				{this.modal_1_View()}
				{this.modal_2_View()}
				{this.modal_3_View()}
				{this.modal_4_View()}

				{/*Ésta es la parte que ve el usuario cuando está en la ventana ObjectScreen*/}

				{ // Caso en que no se ha agregado ninguna imagen y se está haciendo una captura del afloramiento
				(s.listOfImages.length == 0) && p.takingShot &&
					<View style = {{width: D.IMAGE_PICKER_WIDTH, height: p.height, borderWidth: 1, borderColor: 'black'}}/>
				}

				{ // Caso en que ya se agregó una imagen o no se está haciendo una captura del afloramiento
				( (s.listOfImages.length != 0) || (!p.takingShot) ) &&
					<TouchableHighlight onPress = {()=>{this.showModal_1()}} style = {{width: D.IMAGE_PICKER_WIDTH, height: p.height}}>
						<View style = {localStyles.showInstructionsObjectScreen}>

							{/*Mensaje: "(Toque para añadir una foto)"*/}
							{(length == 0) && (p.height >= 18) && <Text>{p.allMessages[10]}</Text>}

							{(length != 0) && (s.uriImageToShow !== null) &&
								<Image 
									resizeMethod = "auto"
									source       = {{ uri: s.uriImageToShow }}
									style        = {{
										width:       D.IMAGE_PICKER_WIDTH, 
										height:      p.height, 
										borderColor: 'black', 
										borderWidth: 1,
									}}		
								/>
							}

							{(length != 0) && (s.uriImageToShow === null) &&
								<View style = {genericStyles.white_background_without_ScrollView}>
									<View style = {genericStyles.simple_center}>
										<ActivityIndicator size = "small" color = "#0000ff" />
									</View>
								</View>
							}						

						</View>
					</TouchableHighlight>
				}
			</View>
		);
	}
}

/// Constante para darle formato a los diversos componentes de esta pantalla
const localStyles = StyleSheet.create({

	// Empleado para mostrar en la ventana "ObjectScreen" el texto que indica que se debe tocar allí para cambiar la fotografía
	showInstructionsObjectScreen: {
		flex:           1,
		flexDirection:  'column',
		justifyContent: 'center',
		alignItems:     'center',
		borderColor:    'black',
		borderWidth:    1,
	},

	// Formato de la vista en la que se muestra una imagen con sus dimensiones originales
	imageView: {
		flex:           1,
		flexDirection:  'column',
		paddingTop:     20, 
		paddingBottom:  15, 
		paddingRight:   15, 
		paddingLeft:    15,
		alignItems:     'center',
		justifyContent: 'center',
	},

	// Formato de cada una de las vistas en donde están los botones del modal más externo: 1) Añadir desde galería, 2) Tomar con la cámara, etc.
	buttonView: {
		flex:           1, 
		alignItems:     'center', 
		justifyContent: 'center', 
		padding:         23,
	},

	// Formato de la imagen que se visualiza encima de su descripción
	touchableHighlight_WithBorder: {
		height:         0.7 * D.GLOBAL_SCREEN_WIDTH, 
		width:          0.7 * D.GLOBAL_SCREEN_WIDTH, 
		borderColor:    'black', 
		borderWidth:    1,
	},

	// Formato del TouchableHighlight en donde está la imagen
	touchableHighlight_NoBorder: {
		height:         0.7 * D.GLOBAL_SCREEN_WIDTH, 
		width:          0.7 * D.GLOBAL_SCREEN_WIDTH, 
	},
});

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages:     ImagePicker_Texts[state.appPreferencesReducer.language], 
		user_id:         state.userReducer.user_id,
		localDB:         state.userReducer.localDB,
		enteringEnabled: state.popUpReducer.stratumComponentEnabled,
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchEnteringPermission: (bool) => dispatch(changeStratumComponentPermission(bool)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(ImagePicker);