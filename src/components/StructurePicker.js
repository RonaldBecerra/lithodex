import React from 'react';
import { Text, Button as ButtonNoIcon, Image, View, Alert,
		 TouchableHighlight, StyleSheet, Modal, ScrollView,
		 FlatList, TextInput} from 'react-native'

import { Avatar, ListItem, Button as ButtonWithIcon, SearchBar} from "react-native-elements"

import { connect } from 'react-redux'
import { changeStratumComponentPermission } from '../redux/actions/popUpActions'
import { StructurePicker_Texts } from '../languages/components/StructurePicker'

import { STRUCTURES_NAMES } from '../constants/structures'

import * as Log      from '../genericFunctions/logFunctions'
import * as Database from '../genericFunctions/databaseFunctions'
import * as auxiliarFunctions from '../genericFunctions/otherFunctions'

import { genericStyles, DARK_GRAY_COLOR, WHITE_COLOR } from '../constants/genericStyles'
import * as D from '../constants/Dimensions'


class StructurePicker extends React.Component {

	constructor(props){
		super(props)
		/* Es necesario este "bind para" que se reconozca el "this" dentro de "deleteStructure"
		  (No sé por qué en esta función sí hace falta y en las otras no) */
		this.deleteStructure = this.deleteStructure.bind(this);

		this.state = {	
			modalVisible: false, // El modal se activa cuando el usuario presiona desde el ObjectScreen para entrar en la vista de estructura

			savedStructure: this.props.data.savedStructure, // Estructura que ya fue guardada en la base de datos
			provStructure:  this.props.data.savedStructure, // Estructura seleccionada por el usuario, pero que todavía no ha sido almacenada en la base de datos

			filter_name: "", // Almacenará el nombre que ingrese el usuario para filtrar la búsqueda
			componentKey: this.props.stratum_key + '_structure', // Para que se sepa qué parte del estrato se va a salvar
		}
	}

	componentDidMount(){
		/* Si no colocáramos esto, si el programador refresca esta página estando dentro de ella en la aplicación, se regresará a la 
		   ventana externa sin haber vuelto a habilitar el permiso de poder ingresar a los componentes. Antes lo habilitábamos una sola vez
		   en la ventana externa, pero ahora en todos los componentes */
		this.props.dispatchEnteringPermission(true);
	}

	// Cada botón que representa una estructura a seleccionar
	touchableStructureToPick(item,i){
		return (
			<TouchableHighlight  // Cada una de las estructuras (imagen y nombre) se muestra en un TouchableHighlight
				onPress = {() => {this.itemSelection(item)}}
				key     = {item.name.concat('TouchableHighlight')}
			>
				<ListItem
					title      = {item.name}
					key        = {item.name.concat('ListItem')}
					leftAvatar = {<Avatar  size="medium"  source={item.uri}/>}
				/>
			</TouchableHighlight>
		)
	}

	/// Función para mostrar las estructuras como botones
	renderStructures (filter_name) {
		let p = this.props;
		return (
			p.sortedStructures.filter(item => auxiliarFunctions.stringIncludesSubstring_NoStrict(item.name,filter_name))
				.map((item, i) => (
					this.touchableStructureToPick(item,i)
				))
		)
	}

	showModal = () => {
		let p = this.props;
		if (this.props.enteringEnabled){
			p.dispatchEnteringPermission(false);
			this.setState({modalVisible: true, filter_name: ""});

			Log.log_action({entry_code: ((p.data.savedStructure != null) ? 19 : 18), user_id: p.user_id, isCore: p.isCore, object_id: p.Object_id, stratum_key: p.stratum_key});	
		}
	}

	hideModal = () => {
		this.props.dispatchEnteringPermission(true);
		this.setState({modalVisible: false, filter_name: ""});
	}

	// Usado cuando el usuario presiona sobre un TouchableHighlight para seleccionar una estructura
	itemSelection (item) {
		var newElement = {
			key: item.key,
			uri: item.uri,
		}
		this.setState({provStructure: newElement})
	}

	// Usado para eliminar la estructura que había sido seleccionada
	deleteStructure (){
		this.setState({provStructure: null});
	}

	// Se activa cuando el usuario presiona el botón "Cancelar"
	cancelSelection = () => {
		let s = this.state;
		let p = this.props;
		if (s.provStructure != s.savedStructure){
			// Alerta: "No se salvaron los cambios"
			Alert.alert(p.allMessages[10], p.allMessages[0]);

			this.setState({provStructure: s.savedStructure});
		}
		this.hideModal();
	}

	// Se activa cuando el usuario le da al botón de "Aceptar"
	acceptSelection = async() => {
		let s = this.state;
		let p = this.props;

		this.setState({savedStructure: s.provStructure});

		const payload = {
			savedStructure: s.provStructure,
		}
		await Database.saveStratumModule(p.user_id, p.Object_id, p.index, s.componentKey, payload, p.isCore, p.localDB);
		this.hideModal();
	}

	// Una vez que se cambia el texto en el que se filtran las estructuras, se invoca este procedimiento
	setFilter = (text) => {
		this.setState({filter_name: text})
	}

	modalView() {
		let s = this.state;
		let p = this.props;

		return (
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {false}
					visible        = {this.state.modalVisible}
					onRequestClose = {this.cancelSelection}
				>
					<View style = {genericStyles.lightGray_background}>

						{/*Cabecera de la pantalla que dice el nombre del estrato que se está modificando*/}
						<View style = {genericStyles.modalHeader}>
							{/* Mensaje: "Estructura del estrato"*/}
							<Text style = {{justifyContent: 'center', alignItems: 'center', fontSize: 17, fontWeight: 'bold'}}>
								{p.allMessages[1]}: {p.stratumName}
							</Text>
						</View>

						{/*Parte en la que el usuario selecciona la estructura*/}
						<View style = {genericStyles.white_background_without_ScrollView}>

							{/*Aquí el usuario puede filtrar la búsqueda de la estructura*/}
							<SearchBar
								value                  = {s.filter_name}
								selectTextOnFocus      = {true}
								lightTheme             = {true}
								textAlign              = {'center'} 
								inputStyle             = {{color: 'black', backgroundColor: WHITE_COLOR}}
								placeholder            = {p.allMessages[2]} // Mensaje: "Buscar..."
								placeholderTextColor   = {'gray'}
								onChangeText           = {text => this.setFilter(text)}
							/>

							{/*En esta parte debe mostrarse la lista de estructuras*/}
							<View style = {localStyles.structurePicker}>
								<ScrollView>
									{this.renderStructures(s.filter_name)}
								</ScrollView>
							</View>

						</View>

						{/*//Parte en la que se muestra el nombre de la estructura seleccionada, lista para ser agregada*/}
						<View style = {genericStyles.smallRow}>

							<View style = {{paddingRight: 10}}>
								<Text style = {{textAlign: 'center',justifyContent: 'center', alignItems: 'center', color: 'blue'}}>{p.allMessages[3]}:{'\n'}	
									<Text style = {{color: 'black'}}>
										{(s.provStructure == null) ? null :
											p.allStructuresNames.find(element => element.key === s.provStructure.key).name}
									</Text>	
								</Text>
							</View>

							<View style = {{paddingLeft: 10}}>
								<ButtonNoIcon 
									raised
									title   = {p.allMessages[4]} /// Mensaje: "Eliminar"
									color   = 'red'
									onPress = {this.deleteStructure}
								/>
							</View>

						</View>

						{/*//Segundo sector, que es la vista de los botones para darle Aceptar o Cancelar*/}
						<View style = {genericStyles.down_buttons}>

							<View style = {{paddingRight: 25}}>
								<ButtonNoIcon 
									raised
									title   = {p.allMessages[5]} // Mensaje: "Cancelar"
									color   = {DARK_GRAY_COLOR}
									onPress = {this.cancelSelection}
								/>
							</View>

							<View style = {{paddingLeft: 25}}>
								<ButtonWithIcon
									raised
									title   = {p.allMessages[6]}  /// Mensaje: "Aceptar"
									icon    = {{name: 'check'}}
									onPress = {this.acceptSelection}
								/>
							</View>
						</View>

					</View>
				</Modal>
			</View>
		)
	}

	/// Lo que se le mostrará al usuario
  	render() {
		let s = this.state;
		let p = this.props;

		return (
			<View>

				{/*Ésta es la parte que ve el usuario cuando ingresa a la sección de estructura sedimentaria*/}
				{this.modalView()}

				{/*Ésta es la parte que ve el usuario cuando está en la ventana externa*/}

				{ // Caso en que no se ha seleccionado ninguna imagen y se está haciendo una captura del afloramiento
				!s.savedStructure && p.takingShot &&
					<View style = {{width: D.STRUCTURE_PICKER_WIDTH, height: p.height, borderWidth: 1, borderColor: 'black'}}/>
				}

				{ // Caso en que no se ha seleccionado ninguna estructura, la altura es menor que 18 y no se está haciendo captura del afloramiento
				!s.savedStructure && (p.height < 18) && (!p.takingShot) &&
					<TouchableHighlight onPress = {() => {this.showModal()}} style = {{width: D.STRUCTURE_PICKER_WIDTH, height: p.height}}>
						<View style = {localStyles.showInstructionsObjectScreen}/>
					</TouchableHighlight>
				}

				{ /// Caso en que no se ha seleccionado ninguna estructura, la altura es mayor o igual que 18 y no se está haciendo captura del afloramiento
				!s.savedStructure && (p.height >= 18) && (!p.takingShot) &&
					<TouchableHighlight onPress = {() => {this.showModal()}} style = {{width: D.STRUCTURE_PICKER_WIDTH, height: p.height}}>
						<View style = {localStyles.showInstructionsObjectScreen}>
							{/*Mensaje: "(Toque para cambiar la estructura)"*/}
							<Text>{p.allMessages[7]}</Text> 
						</View>
					</TouchableHighlight>
				}

				{ /// Caso en que ya se seleccionó una estructura
				s.savedStructure && 
					<TouchableHighlight onPress = {() => {this.showModal()}} style = {{width: D.STRUCTURE_PICKER_WIDTH, height: p.height}}>
						<View style = {localStyles.image}>
							<Image
								resizeMethod = "auto"
								source = {s.savedStructure.uri} 
								style  = {{
									width:       D.STRUCTURE_PICKER_WIDTH,
									height:      p.height,
									opacity:     1,
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

	// Empleado para mostrar en la ventana "ObjectScreen" el texto que indica que se debe tocar allí para cambiar la estructura
	showInstructionsObjectScreen: {
		flex:           1,
		flexDirection:  'column',
		justifyContent: 'center',
		alignItems:     'center',
		borderColor:    'black',
		borderWidth:    1,
	},

	// Para mostrar la imagen de la estructura en la ventana externa
	image: {
		flex:           1,
		flexDirection:  'row',
		justifyContent: 'flex-start',
		alignItems:     'center',
	},

	// Formato para mostrar una estructura (no la lista completa, sino una específica)
	structurePicker: {
		flex:          8,
		flexDirection: 'column',
		padding:       10,
	},

});

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages:      StructurePicker_Texts[state.appPreferencesReducer.language],  
		user_id:          state.userReducer.user_id,
		localDB:          state.userReducer.localDB,
		sortedStructures: state.libraryReducer.sortedStructures,
		enteringEnabled:  state.popUpReducer.stratumComponentEnabled,

		// Aquí almacenamos los nombres de las estructuras que se le mostrarán al usuario, de acuerdo al idioma
		allStructuresNames: STRUCTURES_NAMES[state.appPreferencesReducer.language],
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchEnteringPermission: (bool) => dispatch(changeStratumComponentPermission(bool)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(StructurePicker);