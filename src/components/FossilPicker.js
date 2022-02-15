import React from 'react';
import { Text, Button as ButtonNoIcon, Image, View, Alert,
		 TouchableHighlight, StyleSheet, Modal, ScrollView,
		 FlatList, TextInput } from 'react-native'

import { Avatar, ListItem, Button as ButtonWithIcon, SearchBar} from 'react-native-elements'

import { connect } from 'react-redux'
import { changeStratumComponentPermission } from '../redux/actions/popUpActions'
import { FossilPicker_Texts } from '../languages/components/FossilPicker'

import { FOSSILS_NAMES } from '../constants/fossils'

import * as Log          from '../genericFunctions/logFunctions'
import * as Database     from '../genericFunctions/databaseFunctions'
import { genericStyles, DARK_GRAY_COLOR, WHITE_COLOR } from '../constants/genericStyles'
import * as D            from '../constants/Dimensions'

import * as auxiliarFunctions from '../genericFunctions/otherFunctions'


class FossilPicker extends React.Component {

	constructor(props){
		super(props)

		// Hay tres modales y una vista externa, así que clasificaremos las variables según pertenezcan a cada uno
		this.state = {

			//******* Variables comunes a todas las vistas (modales), o variables de la vista externa (lo que se muestra en el ObjectScreen)

			// Aquí se almacenan todos los fósiles que se han seleccionado y que se han almacenado en la base de datos
			selectedFossils:     (this.props.data.selectedFossils != null) ? this.props.data.selectedFossils : [], 

			fossil_imagesToShow: [], /* Lista de imágenes que se muestran en la ventana externa.
			                            (No siempre se pueden mostrar todos los fósiles que han sido seleccionados)*/
			numberColumnsToShow: 0,  // Cantidad de imágenes que se mostrarán en el ObjectScreen por cada fila que quepa
			numberRowsToShow:    0,  // Cantidad de filas de imágenes que es posible mostrar en el ObjectScreen
			imageDimensions:     0,  // Dimensiones de cada imagen a mostrar

			componentKey: this.props.stratum_key + '_fossil', // Para que se sepa qué parte del estrato se va a salvar

			// Determina si los botones pueden ejecutar sus respectivas funciones, lo cual impide que se presione el mismo botón 
			// por accidente dos veces seguidas, o dos botones contradictorios
			buttonsEnabled: true,

			/******** Variables del modal 1, que es el más externo, que se abre por defecto cuando el usuario presiona desde la ventana
			   externa para agregar o quitar fósiles */
			modal_1_visible: false, // Determina si el usuario entró a la vista en donde se despliegan los fósiles que ya ha seleccionado para este estrato
			renderList:      [],   // Lista de fósiles que se muestran en la ventana principal, que son los ya agregados por el usuario


			/******** Variables del modal 2, que es el que se despliega cuando el usuario presiona sobre un fósil de los que ya había añadido,
			   posiblemente para eliminarlo */
			modal_2_visible: false, // Determina si hay que mostrar o no este modal
			fossilToDelete:  null,  // Fósil que posiblemente será eliminado
		

			//******* Variables del modal 3, que es el que se despliega cuando el usuario le da al botón de "Nuevo fósil"
			modal_3_visible:    false, // Determina si hay que mostrar o no este modal
			filter_name:        "",    // Almacenará el nombre que ingrese el usuario para filtrar la búsqueda de fósiles
			aChangeHasOccurred: false, // Determina si el usuario seleccionó o deseleccionó algún fósil

			// Aquí se almacenan los fósiles que el usuario va marcando, pero esta lista no se guardará en la base de datos hasta que el usuario le dé al botón de aceptar
			selectedFossilsProv: (this.props.data.selectedFossils != null) ? this.props.data.selectedFossils : [], 		
		}
	}

	//******************* Métodos comunes o para la vista externa (lo que se muestra en el ObjectScreen) **********************/
	componentDidMount(){
		/* Si no colocáramos esto, si el programador refresca esta página estando dentro de ella en la aplicación, se regresará a la 
		   ventana externa sin haber vuelto a habilitar el permiso de poder ingresar a los componentes. Antes lo habilitábamos una sola vez
		   en la ventana externa, pero ahora en todos los componentes */
		this.props.dispatchEnteringPermission(true);

		this.createMatrixOfImagesToShow();
		this.create_SelectedFossils_RenderList();
	}

	// Procedimiento para salvar los cambios realizados en la base de datos del usuario
	async saveInDatabase(payload){
		await Database.saveStratumModule(this.props.user_id, this.props.Object_id, this.props.index, this.state.componentKey, payload, this.props.isCore, this.props.localDB);
	}

	// Aquí creamos la lista de imágenes de fósiles seleccionados que se pueden mostrar en la pantalla del ObjectScreen
	createMatrixOfImagesToShow(){
		var s = this.state;
		var h = this.props.height;

		if (D.GLOBAL_SIZE_FOSSIL_IMAGE >= h){
			var imageDimensions  = h - 3;
			var numberRowsToShow = 1; 
		} else {
			var imageDimensions  = D.GLOBAL_SIZE_FOSSIL_IMAGE;
			var numberRowsToShow = parseInt(h / D.GLOBAL_SIZE_FOSSIL_IMAGE); 
		}
		var numberColumnsToShow  = parseInt(D.FOSSIL_PICKER_WIDTH / imageDimensions);

		var i = 0;
		var len = s.selectedFossils.length;

		if (len != 0){
			var fossil_imagesToShow = [];
			for (var k = 0; k < numberRowsToShow; k++){
				var break_k = false;
				var newRow  = [];

				for (var j = 0; j < numberColumnsToShow; j++){
					newRow.push(s.selectedFossils[i]);
					i ++;

					if (i == len){
						break_k = true;
						break;
					}
				}
				fossil_imagesToShow.push(newRow);
				if (break_k){
					break;
				}
			}	
		} else {
			fossil_imagesToShow = [[]];
		}	
		this.setState({fossil_imagesToShow, imageDimensions, numberRowsToShow, numberColumnsToShow});
	}

	// Función para mostrar en la ventana externa las imágenes de algunos de los fósiles que ya han sido seleccionados 
	external_renderFossilImages(){
		let s = this.state;

		return (
			<View style = {{justifyContent: 'center', alignItems: 'center'}}>
				{s.fossil_imagesToShow.map((rowOfImages, i) => (
					<View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}} key={i}>
						{rowOfImages.map((item, k) => (
							<Image 
								key    = {k}
								source = {item.uri} 
								style  = {{width: s.imageDimensions, height: s.imageDimensions, opacity: 1}}
							/>
						))}
					</View>
				))}	
			</View>
		)
	}

	//******************* Métodos para el modal 1, que muestra los fósiles ya seleccionados **********************/

	// Activa el modal 
	showModal_1 = () => {
		let p = this.props;
		if (this.props.enteringEnabled){
			p.dispatchEnteringPermission(false);
			this.setState({modal_1_visible: true});

			Log.log_action({entry_code: ((p.data.selectedFossils != null) ? 21 : 20), user_id: p.user_id, isCore: p.isCore, object_id: p.Object_id, stratum_key: p.stratum_key});
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

	// Crea la lista de fósiles ya seleccionados, que muestra la imagen junto al nombre
	create_SelectedFossils_RenderList(){
		let s = this.state;
		let p = this.props;
		this.setState({
			renderList: s.selectedFossils.map((item, index) => (
				<ListItem							
					key         = {index}
					title       = {p.allFossilNames.find(element => element.key === item.key).name}  
					bottomDivider
					onLongPress = {() => {this.showModal_2(item)}}
					leftAvatar  = {<Avatar  size="medium"  source={item.uri}/>}
				/>
			))
		})
	}

	//******************* Métodos para el modal 2, que permite eliminar un fósil seleccionado previamente **********************/

	// Activa el modal 
	showModal_2 = (item) => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {
				this.setState({modal_2_visible: true, fossilToDelete: item}, () => this.setState({buttonsEnabled: true}));
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

	// Aquí eliminamos el fósil tanto de la base de datos como del estado de esta vista
	deleteFossil (fossilToDelete) {
		let p = this.props;	

		// Procedimiento auxiliar que se invoca cuando se confirma que se desea eliminar el fósil
		let deleteFossilAux = async(p, fossilToDelete) => {
			let s = this.state;

			// Borrar el fósil de las variables de esta vista, que no están en la base de datos
			const key_to_delete = fossilToDelete.key;
			const list = await this.state.selectedFossils.filter(function(item){
				return item.key.toString() !== key_to_delete.toString()
			})
			await this.setState({selectedFossils: list});

			// Tenemos que actualizar las listas de fósiles seleccionados
			this.create_SelectedFossils_RenderList(); // Lista completa de fósiles seleccionados
			this.createMatrixOfImagesToShow(); // Matriz parcial, con sólo las imágenes que se pueden mostrar en la vista externa

			this.hideModal_2();
			await this.saveInDatabase({selectedFossils: list}); // Salvamos la lista de fósiles actualizada en la base de datos
		}

		// Alerta: "¿Seguro de que desea eliminar el fósil?"
		Alert.alert(p.allMessages[12], p.allMessages[13],
			[
				// Mensaje: "Sí"
				{text: p.allMessages[14], onPress: () => deleteFossilAux(p, fossilToDelete)},
				// Mensaje: "No"
				{text: p.allMessages[15]},
			] 
		)
	}

	//******************* Métodos para el modal 3, que permite agregar o quitar fósiles **********************/

	// Activa el modal 
	showModal_3 = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {
				this.setState({
						modal_3_visible: true, 
						selectedFossilsProv: this.state.selectedFossils,
					}, 
					() => this.setState({buttonsEnabled: true})
				);
			})	
		}	
	}

	// Oculta el modal 
	hideModal_3 = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false}, () => {
				this.setState({
						modal_3_visible:     false,
						filter_name:         "",	
						aChangeHasOccurred:  false,
					}, 
					() => this.setState({buttonsEnabled: true})
				);
			})	
		}	
	}

	// Una vez que se cambia el texto en el que se filtran los fósiles, se invoca este procedimiento
	setFilter = (text) => {
		this.setState({filter_name: text})
	}

	// Usado cuando el usuario presiona sobre un TouchableHighlight para seleccionar un fósil
	itemSelection = async(item, indexItem) => {
		const { selectedFossilsProv } = this.state;

		// Esto asegura que varios ckeckboxes no se vean afectados cuando se presiona uno
		if (indexItem != -1) {
			selectedFossilsProv.splice(indexItem, 1),
			this.setState({ 
				aChangeHasOccurred:  true,
			});

		} else {
			await this.setState({ 
				selectedFossilsProv: [...selectedFossilsProv, item], 
				aChangeHasOccurred:  true, 
			});
		}
	};

	// Cada botón que representa un fósil a seleccionar
	touchableFossilToPick(item, indexItem, i) {
		let isChecked = (indexItem != -1);
		return (
			<View key = {i}>
				<ListItem
					title      = {item.name}
					leftAvatar = {<Avatar  size="medium"  source={item.uri}/>}
					checkBox = {{
						checked: isChecked,
						onPress: () => this.itemSelection({key: item.key, uri: item.uri}, indexItem),	
					}}
				/>
			</View>
		)
	}

	/// Función para mostrar los fósiles como botones en la lista de fósiles a seleccionar
	renderFossilsToSelect (filter_name) {
		let p = this.props;
		return (
			p.sortedFossils.filter(item => auxiliarFunctions.stringIncludesSubstring_NoStrict(item.name,filter_name))
				.map((item, i) => (
					this.touchableFossilToPick(item, this.state.selectedFossilsProv.findIndex(element => element.key === item.key), i)
				))
		)
	}

	// Usado cuando el usuario presiona el botón "Cancelar" para no guardar los cambios
	dontAcceptChanges(){
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});

			let s = this.state;
			let p = this.props;

			if (s.aChangeHasOccurred){
				// Alerta: "No se salvaron los cambios"
				Alert.alert(p.allMessages[12], p.allMessages[0]);
			};
			this.setState({selectedFossilsProv: s.selectedFossils, buttonsEnabled: true}, () => this.hideModal_3());
		}
	}

	// Usado cuando el usuario presiona el botón "Aceptar" para añadir el fósil que había seleccionado
	acceptChanges = async() =>{
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});

			let s = this.state;
			let p = this.props;

			if (s.aChangeHasOccurred){
				// Salvamos la lista de fósiles actualizada en la base de datos
				this.saveInDatabase({selectedFossils: s.selectedFossilsProv}); 

				await this.setState({selectedFossils: s.selectedFossilsProv});

				// Tenemos que actualizar las listas de fósiles seleccionados
				this.create_SelectedFossils_RenderList(); // Lista completa

				this.setState({buttonsEnabled: true}, () => this.hideModal_3());

				this.createMatrixOfImagesToShow(); // Matriz parcial, con sólo las imágenes que se pueden mostrar en la vista externa
			}
			else {
				this.setState({buttonsEnabled: true}, () => this.hideModal_3());
			}
		}
	}

	// ************************************** Distintas vistas para el usuario **********************************************

	// Esto es lo que se muestra cuando el usuario entra en la ventana para agregar o eliminar fósiles desde la vista externa (ObjectScreen)
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
							{/* Mensaje: "Fósiles del estrato"*/}
							<Text style = {{justifyContent: 'center', alignItems: 'center', fontSize: 17, fontWeight: 'bold'}}>
								{p.allMessages[1]}: {p.stratumName}
							</Text>
						</View>

						{/*Lista desplegada de fósiles que se han añadido*/}
						<View style = {{ flex: 0.9, flexDirection: 'row'}}>
							<ScrollView>
								{s.renderList}
							</ScrollView>      	
						</View>

						{/*//Vista de los botones "Volver" y "Añadir o quitar"*/}
						<View style = {genericStyles.down_buttons}>

							<View style = {{paddingRight: 25}}>
								<ButtonNoIcon 
									raised
									title   = {p.allMessages[4]} // Mensaje: "Volver"
									color   = {DARK_GRAY_COLOR}
									onPress = {this.hideModal_1}
								/>
							</View>

							<View style = {{paddingLeft: 25}}>
								<ButtonWithIcon
									raised
									title   = {p.allMessages[2]} /// Mensaje: "Añadir o quitar"
									icon    = {{name: 'playlist-add'}}
									onPress = {this.showModal_3}
								/>
							</View>

						</View>

					</View>
				</Modal>
			</View>
		)
	}

	/// Esto es lo que se muestra cuando el usuario presiona sobre uno de los fósiles que ya había seleccionado, con la itención de eliminarlo posiblemente
	Modal_2_View(){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				<Modal
					animationType  = "slide"
					transparent    = {false}
					visible        = {this.state.modal_2_visible}
					onRequestClose = {() => this.hideModal_2()}
				>

					<View style = {{flex: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'column', marginTop: 70}}>

						<View style = {{flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 70}}>
							<ButtonNoIcon // Botón para eliminar el fósil
								raised
								title   = {p.allMessages[3]} // Mensaje: "Eliminar fósil" 
								color   = 'red'
								onPress = {() => this.deleteFossil(s.fossilToDelete)}
							/>
						</View>

						<View style = {{flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 70}}>
							<ButtonNoIcon  /// Botón para regresar a la lista de fósiles, es decir, cerrar el "modal"
								raised
								color   = {DARK_GRAY_COLOR}
								title   = {p.allMessages[4]} // Mensaje: "Volver"
								onPress = {this.hideModal_2}
							/>
						</View>
					</View>

				</Modal>
			</View>
		)
	}

	// Lo que se muestra cuando el usuario le da al botón de "Nuevo fósil"
	Modal_3_View(){
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

						{/*Primer sector que incluye el filtro de búsqueda y la lista desplegada de fósiles*/}
						<View style = {genericStyles.white_background_without_ScrollView}>

							{/*Aquí el usuario puede filtrar la búsqueda del fósil*/}
							<SearchBar
								value                  = {s.filter_name}
								selectTextOnFocus      = {true}
								lightTheme             = {true}
								textAlign              = {'center'} 
								inputStyle             = {{color: 'black', backgroundColor: WHITE_COLOR}}
								placeholder            = {p.allMessages[7]} // Mensaje: "Buscar..."
								placeholderTextColor   = {'gray'}
								onChangeText           = {text => this.setFilter(text)}
							/>

							{/*En esta parte deben mostrarse los fósiles*/}
							<View style = {localStyles.fossilPicker}>
								<ScrollView>
									{this.renderFossilsToSelect(s.filter_name)}
								</ScrollView>
							</View>

						</View>

						{/*//Parte en la que se muestra la cantidad de fósiles seleccionados*/}
						<View style = {genericStyles.smallRow}>
							<Text style = {{textAlign: 'center', justifyContent: 'center', alignItems: 'center', color: 'blue'}}>
								{s.selectedFossilsProv.length} {p.allMessages[8]}
							</Text>
						</View>

						<View style = {genericStyles.down_buttons}>

							<View style = {{paddingRight: 25}}>
								<ButtonNoIcon
									raised
									color   = {DARK_GRAY_COLOR}
									title   = {p.allMessages[9]} /// Mensaje: "Cancelar"
									onPress = {() => this.dontAcceptChanges()}
								/>
							</View>

							<View style = {{paddingLeft: 25}}>
								<ButtonWithIcon
									raised
									title   = {p.allMessages[10]} // Mensaje: "Aceptar"
									icon    = {{name: 'check'}}
									onPress = {() => this.acceptChanges()}
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

				{/*Esto es la parte que ve el usuario cuando está en la ventana externa*/}

				{ // Caso en que no se ha seleccionado ningún fósil y se está haciendo una captura del afloramiento
				(s.selectedFossils.length == 0) && p.takingShot &&
					<View style = {{width: D.FOSSIL_PICKER_WIDTH, height: p.height, borderWidth: 1, borderColor: 'black'}}/>
				}

				{ // Caso en que no se ha seleccionado ningún fósil, la altura es menor que 18 y no se está haciendo una captura del afloramiento
				(s.selectedFossils.length == 0) && (p.height < 18) && (!p.takingShot) &&
					<TouchableHighlight onPress={()=>{this.showModal_1()}}  style={{width: D.FOSSIL_PICKER_WIDTH, height: p.height}}>
						<View style = {localStyles.showInstructionsObjectScreen}/>
					</TouchableHighlight>
				}

				{ /// Caso en que no se ha seleccionado ningún fósil, la altura es mayor o igual que 18 y no se está haciendo una captura del afloramiento
				(s.selectedFossils.length == 0) && (p.height >= 18) && (!p.takingShot) &&
					<TouchableHighlight onPress={()=>{this.showModal_1()}}  style={{width: D.FOSSIL_PICKER_WIDTH, height: p.height}}>
						<View style = {localStyles.showInstructionsObjectScreen}>
							{/*Mensaje: "(Toque para agregar fósiles)"*/}
							<Text>{p.allMessages[11]}</Text>
						</View>
					</TouchableHighlight>
				}

				{ /// Caso en que ya ha sido seleccionado algún fósil
				(s.selectedFossils.length != 0) && 
					<TouchableHighlight onPress={()=>{this.showModal_1()}}  style={{width: D.FOSSIL_PICKER_WIDTH, height: p.height}}>
						<View style = {localStyles.showInstructionsObjectScreen}>
							{this.external_renderFossilImages()}
						</View>
					</TouchableHighlight>
				}
			</View>
		);
	}
}

/// Constante para darle formato a los diversos componentes de esta pantalla
const localStyles = StyleSheet.create({

	// Empleado para mostrar en la ventana "ObjectScreen" el texto que indica que se debe tocar allí para cambiar el fósil, o bien los fósiles seleccionados
	showInstructionsObjectScreen: {
		flex:           1,
		flexDirection:  'column',
		justifyContent: 'center',
		alignItems:     'center',
		borderColor:    'black',
		borderWidth:    1,
	},

	// Formato para mostrar la lista completa de fósiles a seleccionar
	fossilPicker: {
		flex:           8,
		flexDirection:  'column',
		padding:        10
	},

});

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages:     FossilPicker_Texts[state.appPreferencesReducer.language], 
		user_id:         state.userReducer.user_id,
		localDB:         state.userReducer.localDB,
		sortedFossils:   state.libraryReducer.sortedFossils,
		enteringEnabled: state.popUpReducer.stratumComponentEnabled,

		// Aquí almacenamos los nombres de los fósiles que se le mostrarán al usuario
		allFossilNames:  FOSSILS_NAMES[state.appPreferencesReducer.language],
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchEnteringPermission: (bool) => dispatch(changeStratumComponentPermission(bool)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(FossilPicker);