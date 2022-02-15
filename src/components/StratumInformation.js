import React from 'react';
import { Text, Image, View, ScrollView, Modal, StyleSheet,
	     TouchableHighlight, Button as ButtonNoIcon} from 'react-native';

import { NavigationEvents } from 'react-navigation'
import { connect } from 'react-redux'
import { changeStratumComponentPermission } from '../redux/actions/popUpActions'
import { StratumInformation_Texts } from '../languages/components/StratumInformation'

import {Button as ButtonWithIcon} from 'react-native-elements'
import * as D from '../constants/Dimensions'
import { DARK_GRAY_COLOR } from '../constants/genericStyles'


class StratumInformation extends React.Component {

	constructor(props){
		super(props);

		this.state = {
			modalVisible: false,
			index:        this.props.index,

			// Determina si los botones pueden ejecutar sus respectivas funciones, lo cual impide que se presione el mismo botón 
			// por accidente dos veces seguidas, o dos botones contradictorios
			buttonsEnabled: true,
		}
	}

	componentDidMount(){
		/* Si no colocáramos esto, si el programador refresca esta página estando dentro de ella en la aplicación, se regresará a la 
		   ventana externa sin haber vuelto a habilitar el permiso de poder ingresar a los componentes. Antes lo habilitábamos una sola vez
		   en la ventana externa, pero ahora en todos los componentes */
		this.props.dispatchEnteringPermission(true);
	}

	// Para entrar en la vista completa desde la ventana externa
	showModal = () => {
		if (this.props.enteringEnabled){
			this.props.dispatchEnteringPermission(false);
			this.setState({modalVisible: true});
		}
	}

	// Se activa cuando el usuario presiona el botón "Volver"
	hideModal = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});	
			this.props.dispatchEnteringPermission(true);
			this.setState({modalVisible: false}, () => this.setState({buttonsEnabled: true}));
		}
	}

	// Función para ir a la vista del formulario de estrato
	goToStratumForm = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});	
			let p = this.props;
			this.hideModal();

			const payload = {
				index:       p.index,
				thickness:   p.thickness,
				stratumName: p.stratumName,
				unit:        p.unit,
				_id:         p.Object_id,
				scale:       p.scale,
				key:         p.stratum_key,
				baseHeight:  p.baseHeight,
				isCore:      p.isCore,
			};
			p.navigation.navigate({ key: 'ObjectStratumForm', routeName: 'ObjectStratumForm', params: payload});
			this.setState({buttonsEnabled: true});	
		}
	}

	//Lo que se muestra cuando el usuario ingresa en el menú de información de estrato
	modalView(){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				<Modal
					animationType   = "fade"
					transparent     = {false}
					visible         = {this.state.modalVisible}
					onRequestClose  = {this.hideModal}
				>
					<View style = {{paddingTop: 10, alignItems: 'center'}}>
						<Text style = {{fontSize: 25, fontWeight:'bold'}}>Información de estrato</Text>
					</View>

					<View style = {styles.showInModal}>	
							<Text style = {{fontWeight: 'bold'}}>{p.allMessages[0]}: <Text style = {{fontWeight: 'normal'}}>{p.stratumName}{"\n"}</Text></Text>
							<Text style = {{fontWeight: 'bold'}}>{p.allMessages[1]}: <Text style = {{fontWeight: 'normal'}}>{(p.unit == 0) ? (p.thickness[0][1] + ' m') : (p.thickness[1][1] + ' ft')}{"\n"}</Text></Text>
							<Text style = {{fontWeight: 'bold'}}>{p.allMessages[2]}: <Text style = {{fontWeight: 'normal'}}>{(p.unit == 0) ? (p.upperLimit[0][1] + ' m') : (p.upperLimit[1][1] + ' ft')}{"\n"}</Text></Text>
							<Text style = {{fontWeight: 'bold'}}>{p.allMessages[3]}: <Text style = {{fontWeight: 'normal'}}>{(p.unit == 0) ? (p.lowerLimit[0][1] + ' m') : (p.lowerLimit[1][1] + ' ft')}{"\n"}</Text></Text>
					</View>

					<View style = {styles.buttonStyle}>
						<ButtonWithIcon  /// Botón para ir a la ventana de modificar estrato
							raised
							icon    = {{name: 'create'}}
							title   = {p.allMessages[4]} // Mensaje: "Modificar estrato"
							onPress = {() => {this.goToStratumForm()}}
						/>
					</View>

					<View style = {styles.buttonStyle}>
						<ButtonNoIcon  /// Botón para cerrar el "modal"
							raised
							color   = {DARK_GRAY_COLOR}
							title   = {p.allMessages[5]} // Mensaje: "Volver"
							onPress = {this.hideModal}
						/>
					</View>
				</Modal>	
			</View>
		)
	}

	/// Lo que se le muestra al usuario
	render (){
		let s = this.state;
		let p = this.props;
		return (
			<View>

				{/*Lo que se muestra cuando el usuario ingresa en el menú de información de estrato*/}
				{this.modalView()}				

				{/*Ésta es la parte que ve el usuario cuando está en la ventana OutcropScreen o de CoreScreen*/}
				<TouchableHighlight 
					onPress = {()=>{this.showModal()}} 
					style = {{width: D.STRATUM_INFORMATION_WIDTH, height: p.height}}
				>
					<View style = {styles.showInOuterScreen}>
						{(p.height >= 18) && (p.height < 37) &&
							<View>					
								<Text style = {styles.shownName}>{p.stratumName}</Text>
							</View>
						}
						{(p.height >= 37) && (p.height < 65) &&
							<View>					
								<Text style = {styles.shownName}>{p.stratumName}</Text>
								<Text>{p.allMessages[1]}: {(p.unit == 0) ? (p.thickness[0][1] + ' m') : (p.thickness[1][1] + ' ft')}</Text>
							</View>
						}
						{(p.height >= 65) &&
							<View>					
								<Text style = {styles.shownName}>{p.stratumName}</Text>
								<Text>{p.allMessages[6]}: {(p.unit == 0) ? (p.upperLimit[0][1] + ' m') : (p.upperLimit[1][1] + ' ft')}</Text>
								<Text>{p.allMessages[7]}: {(p.unit == 0) ? (p.lowerLimit[0][1] + ' m') : (p.lowerLimit[1][1] + ' ft')}</Text>
							</View>
						}
					</View>
				</TouchableHighlight>
			</View>
		);
	}
}

/// Constante para darle formato a los diversos componentes de esta pantalla
const styles = StyleSheet.create({

	// Formato de lo que se muestra en la ventana "OutcropScreen" o "CoreScreen"
	showInOuterScreen: {
		flex:           1,
		alignItems:     'center',
		justifyContent: 'center',
		borderColor:    'black',
		borderWidth:    1,
	},

	// Para darle formato a los botones que se muestran en esta pantalla
	buttonStyle: {
		flex:           0.25, 
		alignItems: 	'center', 
		justifyContent: 'center', 
		padding:        10,
	},

	// Formato del texto del nombre de estrato que se muestra en la ventana "OutcropScreen" o "CoreScreen"
	shownName: {
		justifyContent: 'center', 
		alignItems:     'center', 
		fontStyle:      'italic',
		textAlign:      'center',
	},

	// Formato del modal
	showInModal: {
		flex:           1,
		flexDirection:  'column',
		alignItems:     'center',
		justifyContent: 'center',	
	}
});

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages:     StratumInformation_Texts[state.appPreferencesReducer.language],
		enteringEnabled: state.popUpReducer.stratumComponentEnabled,
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchEnteringPermission: (bool) => dispatch(changeStratumComponentPermission(bool)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(StratumInformation);