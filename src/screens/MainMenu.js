import React, { Component } from 'react';
import { StyleSheet, Text, View, Image, TouchableHighlight, Alert,
		 ScrollView, Platform, ImageBackground} from 'react-native';

import { NavigationEvents } from 'react-navigation'

import { connect } from 'react-redux'
import { changeUser, changeUserName, changeUserProfileImage, changeUserPrivileges, changeSyncHandler } from '../redux/actions/userActions'
import { bindActionCreators } from 'redux'
import * as Network from 'expo-network';

import { MainMenu_Texts } from '../languages/screens/MainMenu'

import {genericStyles}    from '../constants/genericStyles'
import * as genericImages from '../constants/genericImages'
import * as D             from '../constants/Dimensions'
import * as appConstants  from '../constants/appConstants'
import * as Log           from '../genericFunctions/logFunctions'
import * as Database      from '../genericFunctions/databaseFunctions'


// Definir constantes globales
const GLOBAL_BUTTON_WIDTH  = 0.32 * D.MIN_GLOBAL_DIMENSION; // Anchura de las imágenes que representan los botones en esta vista
const GLOBAL_BUTTON_HEIGHT = 0.315 * D.MIN_GLOBAL_DIMENSION; // Altura de las imágenes que representan los botones en esta vista
const UNDERLAY_COLOR       = '#cccc';

class MainMenu extends Component {

	constructor(props){
		super(props)
		this.state = {
			// Esto para impedir que el usuario le dé a dos botones de manera seguida, lo cual podría ocasionar que se ejecuten dos procesos en paralelo,
			// como que se empilen dos vistas distintas en la nageación de pila, o que se cierre sesión al mismo tiempo que se empila la vista de editar usuario
			buttonsEnabled: true,
		}
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps }) => {
		return ({
			title:           MainMenu_Texts[screenProps.language][12],
			headerTintColor: screenProps.headerTintColor,
			headerStyle: {
				backgroundColor: screenProps.headerBackgroundColor,
				...genericStyles.navigationHeader,
			}
		})
	};

	// Para registrar en el "log" que se ha iniciado la aplicación
	componentDidMount() {
		Log.log_action({entry_code: 1, user_id: this.props.user_id});  
	}

	// Procedimiento para ir a la vista de edición del perfil de usuario
	editProfile = async() => {
		let p = this.props;
		var payload = {};

		await p.localDB.get(appConstants.DEFAULT_DOCUMENT_ID)
			.then(document => {
				// Si dejamos como campo "_id" el que se recupera de "document", 
				// no obtendremos el "_id" del usuario sino el de este docmento: <appConstants.DEFAULT_DOCUMENT_ID>
				document._id = p.user_id;
				payload = document;

				// Volvemos a despachar las variables necesarias a la Tienda Redux por si acaso cambiaron en otra sesión abierta
				p.dispatchChangeProfileImage(document.information.profileImage);
				p.dispatchChangePrivileges(document.privileges);
				p.dispatchChangeUserName(document.userName);
			}).catch(error => {
				console.error(error.toString());
			})
		this.navigateToScreen('UserForm', payload);
	}

	// Procedimiento para navegar a otra vista, e inmediatamente impedir que se navegue a otra al mismo tiempo, haciendo falso el booleano "buttonsEnabled"
	navigateToScreen = (newScreen, params=null) => {
		this.setState({buttonsEnabled: false}, () => {
			this.props.navigation.navigate({key: newScreen, routeName: newScreen, params});
		});		
	}

	// Procedimiento para cerrar la sesión
	logOut = () => {
		this.setState({buttonsEnabled: false}, async() => {

			if (this.props.syncHandler !== null){
				// Si destruyéramos la base de datos local sin haber cancelado la sincronización, destruiríamos también la remota
				await this.props.syncHandler.cancel();
			}	 
			// Al cerrar sesión, siempre cambiamos al usuario no autenticado
			this.props.dispatchResetSyncHandler();	
			this.props.dispatchChangeProfileImage(null);
			this.props.dispatchChangePrivileges(0);
			this.props.dispatchChangeUserName(null);

			const {isInternetReachable, isConnected} = await Network.getNetworkStateAsync();
			if (isInternetReachable && isConnected){
				// Si hay internet, todo lo que se salvó en la base de datos local del usuario se salvó también
				// en la remota, de modo que ya no hace falta mantener la local almacenada en el dispositivo.
				this.props.localDB.destroy(); 

				// De lo contrario, la local no se destruye, y lo que puede haber en ella adicional a la remota se replicará cuando
				// se vuelva a iniciar sesión con la misma cuenta
			}
			this.props.dispatchLogOut(appConstants.UNAUTHENTICATED_ID);
			Database.logOut();

			// Alerta: "Se ha cerrado la sesión"
			Alert.alert(this.props.allMessages[14], this.props.allMessages[10]);

			this.setState({buttonsEnabled: true});
		})
	}

	// Lo que se le mostrará al usuario
	render(){
		let p = this.props;
		console.log('Running on '+Platform.OS+' '+Platform.Version);
		
		if ((Platform.Version <= 14) && Platform.OS=='android') {
			return(
				<View style = {styles.menu}>
					{/*Mensaje: "Lamentablemente, LithoDex sólo funciona correctamente en versiones de Android 4.1 o mayor" */}
					<Text>{p.allMessages[0]}</Text>
					}
				</View>
			)
		}

		let isUnauthenticated = (this.props.user_id == appConstants.UNAUTHENTICATED_ID);

		return(
			< //Imagen de fondo. Nota: Usar ImageBackground implica que todo el resto del contenido tiene que anidarse, a diferencia de si usáramos Image
			ImageBackground source = {genericImages.MAIN_MENU_BACKGROUND} style = {{flex: 1, flexDirection: 'column'}}>
				<NavigationEvents onDidFocus = {payload => this.setState({buttonsEnabled: true})}/>

				{/*Barra superior en la que se encuentran las opciones de inicio de sesión. Esto se muestra cuando el usuario no está autenticado*/}
				{(isUnauthenticated) &&
					<View style = {styles.sessionBar}>

						{/*Botón para registrarse*/}
						<Text 
							onPress = {this.state.buttonsEnabled ? () => this.navigateToScreen('UserForm') : () => {}}
							style   = {styles.text}
						>
							{p.allMessages[2]}
						</Text> 

						{/*//Botón para iniciar sesión*/}
						<Text 
							onPress = {this.state.buttonsEnabled ? () => this.navigateToScreen('Login') : () => {}}
							style   = {styles.text}
						>
							{p.allMessages[3]}
						</Text> 
					</View>
				}

				{/*Barra superior en la que se encuentran las opciones de editar perfil y cerrar sesión*/}
				{(!isUnauthenticated) &&
					<View style = {styles.sessionBar}>
						{/*Botón para editar perfil*/}
						<Text 
							onPress = {this.state.buttonsEnabled ? () => this.editProfile() : () => {}}
							style   = {styles.text}
						>
							{p.allMessages[4]}
						</Text> 

						{/*//Botón para cerrar sesión*/}
						<Text 
							onPress = {this.state.buttonsEnabled ? () => this.logOut() : () => {}}
							style   = {styles.text}
						>
							{p.allMessages[5]}
						</Text> 
					</View>
				}

				<ScrollView>
					<View style = {styles.menu}>	

						<Image  // Imagen de título: LithoDex
							style  = {styles.lithoDexImage}
							source = {genericImages.LITHODEX_ICON}
						/>

						<View style = {styles.row}>  
							<TouchableHighlight /// Botón para ir a la vista: "Galería de afloramientos"
								onPress       = {this.state.buttonsEnabled ? () => this.navigateToScreen('ObjectGallery', {isCore: false}) : () => {}}
								onLongPress   = {this.state.buttonsEnabled ? () => this.navigateToScreen('ObjectGallery', {isCore: false}) : () => {}}
								underlayColor = {UNDERLAY_COLOR}
								style         = {{...styles.buttonHighlight, ...styles.leftButton}}
							>
								<View>
									<Image 
										style  = {{width: GLOBAL_BUTTON_WIDTH, height: GLOBAL_BUTTON_HEIGHT}}
										source = {genericImages.OUTCROP_ICON}
									/>
									<Text style = {styles.buttonHighlight_text}>
										{p.allMessages[6]}
									</Text>
								</View>
							</TouchableHighlight>

							<TouchableHighlight  /// Botón para ir a la vista: "Galería de núcleos"
								onPress       = {this.state.buttonsEnabled ? () => this.navigateToScreen('ObjectGallery', {isCore: true}) : () => {}}
								onLongPress   = {this.state.buttonsEnabled ? () => this.navigateToScreen('ObjectGallery', {isCore: true}) : () => {}}
								underlayColor = {UNDERLAY_COLOR}
								style         = {{...styles.buttonHighlight, ...styles.rightButton}}
							>
								<View>
									<Image 
										style  = {{width: GLOBAL_BUTTON_WIDTH, height: GLOBAL_BUTTON_HEIGHT}}
										source = {genericImages.CORE_ICON}
									/>
									<Text style = {styles.buttonHighlight_text}>
										{p.allMessages[7]}
									</Text>
								</View>
							</TouchableHighlight>
						</View>

						{/*En esta línea (fila) están los botones: "Configuración" y "Sobre LithoDex". Estos botones no vienen acompañados por imágenes como los anteriores.*/}
						<View style = {styles.row}> 
									  
							<TouchableHighlight // Botón para ir a la configuración
								onPress       = {this.state.buttonsEnabled ? () => this.navigateToScreen('Settings') : () => {}}
								onLongPress   = {this.state.buttonsEnabled ? () => this.navigateToScreen('Settings') : () => {}}
								underlayColor = {UNDERLAY_COLOR}
								style         = {{...styles.buttonHighlight, ...styles.leftButton}}
							>
								<Text style   = {styles.buttonHighlight_text}>
									{p.allMessages[8]}
								</Text>
							</TouchableHighlight>
							
							<TouchableHighlight // Botón para ir a la información "Sobre LithoDex"
								onPress       = {this.state.buttonsEnabled ? () => this.navigateToScreen('AboutLithoDex') : () => {}}
								onLongPress   = {this.state.buttonsEnabled ? () => this.navigateToScreen('AboutLithoDex') : () => {}}
								underlayColor = {UNDERLAY_COLOR}
								style         = {{...styles.buttonHighlight, ...styles.rightButton}}
							>
								<Text style   = {styles.buttonHighlight_text}>
									{p.allMessages[9]}
								</Text>
							</TouchableHighlight>
						</View>

						{/*//En esta línea (fila) está el botón para ir a la sección de contactar usuarios*/}
						{(!isUnauthenticated) &&
							<View style = {styles.row}> 						
								<TouchableHighlight
									onPress       = {this.state.buttonsEnabled ? () => this.navigateToScreen('ContactUsersRootComponent') : () => {}}
									onLongPress   = {this.state.buttonsEnabled ? () => this.navigateToScreen('ContactUsersRootComponent') : () => {}}
									underlayColor = {UNDERLAY_COLOR}
									style         = {styles.buttonHighlight}
								>
									<View>
										<Image 
											style  = {{width: GLOBAL_BUTTON_WIDTH, height: GLOBAL_BUTTON_HEIGHT}}
											source = {genericImages.CONTACT_USERS_ICON}
										/>
										<Text style = {styles.buttonHighlight_text}>
											{p.allMessages[13]}
										</Text>
									</View>
								</TouchableHighlight>
							</View>
						}

						{/*Esta funcionalidad sólo le corresponde al administrador*/}
						{ (this.props.privileges == 2) &&
							<View style = {styles.row}>
										  
								<TouchableHighlight // Botón para ir a la ventana del "log"
									onPress       = {this.state.buttonsEnabled ? () => this.navigateToScreen('ConsultLog') : () => {}}
									onLongPress   = {this.state.buttonsEnabled ? () => this.navigateToScreen('ConsultLog') : () => {}}
									underlayColor = {UNDERLAY_COLOR}
									style         = {styles.buttonHighlight}
								>
									<Text style   = {styles.buttonHighlight_text}>
										{p.allMessages[11]}
									</Text>
								</TouchableHighlight>
		
							</View>
						}

					</View>
				</ScrollView>
			</ImageBackground>
		);
	}
}

// Constante para darle formato a los diversos componentes de esta pantalla
const styles = StyleSheet.create({

	// Formato del cintillo superior en el que están los botones de registro, inicio de sesión, etc.
	sessionBar: {
		width:           '100%',
		height:          0.078125 * D.MIN_GLOBAL_DIMENSION, // 25 en mi teléfono
		justifyContent:  'flex-end',
		flexDirection:   'row',
		backgroundColor: '#f5f5f5',
		alignItems:      'center',
	},

	// Formato de los textos que aparecen en la barra superior
	text: {
		textDecorationLine: 'underline',
		padding:            0.01325 * D.MIN_GLOBAL_DIMENSION, // 10 en mi teléfono
		fontSize:           0.04 * D.MIN_GLOBAL_DIMENSION,    // 12.8 en mi teléfono
	},

	// Formato de la imagen superior con el logo de LithoDex
	lithoDexImage: {
		width:        GLOBAL_BUTTON_WIDTH, 
		height:       GLOBAL_BUTTON_HEIGHT, 
		marginTop:    0.035128805 * D.GLOBAL_SCREEN_HEIGHT, // 20 en mi teléfono
		marginBottom: 0.035128805 * D.GLOBAL_SCREEN_HEIGHT, // 20 en mi teléfono
	},

	// Usado para darle formato a toda la parte que tiene la imagen de fondo (no incluye el cintillo superior de registro/inicio de sesión)
	menu: {
		backgroundColor: 'transparent',
		alignItems:      'center',
		justifyContent:  'center',
		padding:         0.01325 * D.MIN_GLOBAL_DIMENSION, // 10 en mi teléfono
	},

	// Formato de las líneas que representan las divisiones horizontales de la vista
	row: {
		flex:            1,
		flexDirection:   'row',
		width:           '100%',
		paddingTop:      0.01375 * D.MIN_GLOBAL_DIMENSION,
		paddingBottom:   0.09375 * D.MIN_GLOBAL_DIMENSION, // 30 en mi teléfono
		backgroundColor: 'transparent',
		alignItems:      'center',
		justifyContent:  'center',
	},

	// Formato de un botón creado con un highlight (no el que trae por defecto html)
	buttonHighlight: {
		backgroundColor: '#f2f2f2',
		borderColor:     '#000000',
		borderRadius:    10,
		paddingTop:      0.0087822 * D.GLOBAL_SCREEN_HEIGHT, 
		paddingBottom:   0.0087822 * D.GLOBAL_SCREEN_HEIGHT,
		width:           GLOBAL_BUTTON_WIDTH,
		alignItems:      'center',
		justifyContent:  'center',
	},

	// Se le anexa al formato buttonHighlight en los botones que quedan a la izquierda de la pantalla
	leftButton: {
		marginLeft:  0.4 * D.GLOBAL_SCREEN_WIDTH, 
		marginRight: 0.125 * D.GLOBAL_SCREEN_WIDTH,
	},

	// Se le anexa al formato buttonHighlight en los botones que quedan a la derecha de la pantalla
	rightButton: {
		marginRight: 0.4 * D.GLOBAL_SCREEN_WIDTH, 
		marginLeft:  0.125 * D.GLOBAL_SCREEN_WIDTH,
	},
  
	// Formato de los textos que se muestran sobre los botones creados con highlight
	buttonHighlight_text: {
		fontSize:   0.04 * D.MIN_GLOBAL_DIMENSION, // 12.8 en mi teléfono
		textAlign:  'center',
		fontWeight: 'bold',
	},
});


// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages: MainMenu_Texts[state.appPreferencesReducer.language], 
		user_id:     state.userReducer.user_id,
		localDB:     state.userReducer.localDB,
		syncHandler: state.userReducer.syncHandler,
		privileges:  state.userReducer.privileges,
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchLogOut:             (user_id)  => dispatch(changeUser(user_id)),
		dispatchResetSyncHandler:   () => dispatch(changeSyncHandler(null)),
		dispatchChangeUserName:     (userName) => dispatch(changeUserName(userName)),
		dispatchChangeProfileImage: (profileImage) => dispatch(changeUserProfileImage(profileImage)),
		dispatchChangePrivileges:   (privileges) => dispatch(changeUserPrivileges(privileges)),
		
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(MainMenu);