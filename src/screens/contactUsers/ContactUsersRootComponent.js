import React, { Component } from 'react'
import { View, ScrollView, SafeAreaView, Text } from 'react-native'

import { Button as ButtonWithIcon } from 'react-native-elements'

import Icon from 'react-native-vector-icons/FontAwesome'

import { connect } from 'react-redux'
import { changeStackScreenPropsFunction, changeHeaderTitle } from '../../redux/actions/popUpActions'
import { createAppContainer } from 'react-navigation'
import { createDrawerNavigator, DrawerItems} from 'react-navigation-drawer'

import { ContactUsersRootComponent_Texts } from '../../languages/screens/contactUsers/ContactUsersRootComponent'
import ShowProfileImageDrawer from './ShowProfileImageDrawer'

import ListOfUsers from './ListOfUsers'

import { genericStyles, DARK_GRAY_COLOR } from '../../constants/genericStyles'

/* Las siguientes variables no pueden ser inicializadas todavía porquue no están dentro de la clase principal de esta vista, y 
   por lo tanto no pueden acceder a this.props.navigation ni a la Tienda Redux. Es necesario definirlas de manera global para
   que la constante "ContactUsersNavigator", que no pertenece a la clase principal, puede acceder a ellas */

var NAVIGATE_PROFILE = null; // Tendrá la función para navegar al perfil del usuario actual
var USERNAME = null; // Nombre de usuario

// Aquí establecemos cuáles serán las ventanas que tendrá este módulo
const ContactUsersNavigator = createDrawerNavigator(
	// Rutas a las distintas ventanas de este navegador
	{
		ListOfAllUsers:        {screen: ListOfUsers(0)},
		ListOfFriends:         {screen: ListOfUsers(1)},
		ListOfUsersRequesting: {screen: ListOfUsers(2)},
		ListOfAllUsersById:    {screen: ListOfUsers(3)}, // Un usuario no administrador no podrá acceder a esta vista, 
		                                                 // lo cual se determina en el "navigationOptions" de "ListOfUsers.js"
	},

	// Opciones del navegador. Ver: https://reactnavigation.org/docs/4.x/drawer-navigator/  y   
	// https://www.codota.com/code/javascript/classes/react-navigation/DrawerItems
	{
		// Esto evita que se sigan activando las funciones de cargar desde base de datos en las vistas que abandonamos cuando la variable "loadView"
		// que está en la Tienda Redux se haga verdadera
		unmountInactiveRoutes: true, 

		// Es necesario ubicarlo a la derecha para que esté justo debajo del botón que permite abrirlo. Dicho botón no se puede
		// colocar a la izquierda porque de lo contrario ocultamos el botón del StackNavigator de regresar a la vista anterior.
		drawerPosition: 'right',

		contentComponent: props => {
			return(
				<SafeAreaView  style={{flex: 1}}  forceInset={{ top: 'always', horizontal: 'never' }}>
					<View style = {{padding: 10, backgroundColor: DARK_GRAY_COLOR}}>
						{/*En esta parte se muestra la imagen de perfil del usuario*/}
						<ShowProfileImageDrawer
							navigateToUserProfile = {NAVIGATE_PROFILE}
						/>
						<Text style = {{textAlign: 'center', color: 'white', fontWeight: 'bold', fontSize: 17}}>
							{USERNAME}
						</Text>
					</View>

					{/*En esta parte vemos los botones para navegar a otras pestañas del Drawer Navigator*/}
					<ScrollView>
						<DrawerItems {...props} />	
					</ScrollView>
				</SafeAreaView>
			)
		}
	}
);

const ContactUsersContainer = createAppContainer(ContactUsersNavigator);

/* El propósito de esta vista es crear el Drawer Navigator que contendrá las demás vistas relacionadas
   con contactar a otros usuarios. Además, muestra la imagen de perfil del usuario */
class ContactUsersRootComponent extends Component {

	constructor(props) {
		super(props)
		const payload = {_id: this.props.user_id};

		// Nótese que no asignamos en NAVIGATE_PROFILE la llamada a la función de navegar, sino una función flecha que al invocarse llama a esa función.
		// De lo contrario, la fnción de navegar se ejecutaría en este momento
		NAVIGATE_PROFILE = (() => this.props.navigation.navigate({ key: 'UserView', routeName: 'UserView', params: payload}));

		USERNAME = this.props.userName;
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps }) => ({
		title:           (screenProps.headerTitle == null) ? ContactUsersRootComponent_Texts[screenProps.language][0] : screenProps.headerTitle,
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		},
		// Aquí colocamos el botón que permite abrir el Drawer Navigator. Las vistas de dicho navegador son las que se encargan,
		// a través de Redux, de hacer que "screenProps.function.ref" almacene la función que hace eso.
		headerRight: (
			<View style = {{paddingRight: 5}}>
				<ButtonWithIcon
					onPress = {() => screenProps.stackFunction.ref()}
					icon    = {<Icon  name="navicon"  size={25}  color="white"/>}
					type    = 'clear'
				/>
			</View>
		),
	});

	/// Al salir de esta ventana liberamos la función global de ScreenProps del StackNavigator, y también el título de la cabecera
	componentWillUnmount(){
		this.props.dispatchStackScreenPropsFunction(() => {});
		this.props.dispatchChangeHeaderTitle(null);
	}

	// Aquí mostramos el Drawer Navigator
	render() {
		return (
			<View style = {{flex:1}}>
				<ContactUsersContainer
					screenProps = {{
						/* Esto sirve para que las vistas de este nuevo navegador puedan llamar a las del navegador de pila.
						   Además, dichas vistas pueden acceder al screenProps del de pila a través de "this.props.screenProps.stackNavigation.getScreenProps()".
						 */
						stackNavigation: this.props.navigation,                                     
					}}
				/>
			</View>	
		)
	}
}

/// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return ({
		openDrawer:  state.popUpReducer.loadView,
		user_id:     state.userReducer.user_id,
		userName:    state.userReducer.userName,
		headerTitle: state.popUpReducer.headerTitle,
	})
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchStackScreenPropsFunction: (globalFunction) => dispatch(changeStackScreenPropsFunction(globalFunction)),
		dispatchChangeHeaderTitle: (title) => dispatch(changeHeaderTitle(title)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(ContactUsersRootComponent);