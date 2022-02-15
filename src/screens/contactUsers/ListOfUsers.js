import React, { Component } from 'react'
import { Text, View, StyleSheet, TextInput, ScrollView, TouchableHighlight,
		ActivityIndicator, FlatList, Keyboard} from 'react-native'

import { Avatar, ListItem, SearchBar, Button as ButtonWithIcon } from "react-native-elements"

import Icon from 'react-native-vector-icons/FontAwesome'

import * as Network from 'expo-network'

import { connect } from 'react-redux'
import { changeLoadView, changeStackScreenPropsFunction, changeHeaderTitle } from '../../redux/actions/popUpActions'
import { ListOfUsers_Texts } from '../../languages/screens/contactUsers/ListOfUsers'

import * as Log          from '../../genericFunctions/logFunctions'
import * as Database     from '../../genericFunctions/databaseFunctions'
import { genericStyles, WHITE_COLOR } from '../../constants/genericStyles'
import { remoteLithodex, USERS_TABLES_DOCUMENT_ID, DEFAULT_DOCUMENT_ID, SERVER_URL } from '../../constants/appConstants'

import * as auxiliarFunctions from '../../genericFunctions/otherFunctions'
import {DEFAULT_USER_ICON} from '../../constants/genericImages'

import PouchDB from 'pouchdb-react-native'


// Máxima cantidad de veces que se puede volver a intentar cargar automáticamente los datos desde la base de datos.
// Si es el usuario el que solicita volver a cargar a través del botón correspondiente en la vista, el contador se reinicia a cero
const MAXIMUM_RETRIES_LOADING_USERS = 3; 

const RECORDS_PER_FETCH = 20; // Cada vez que vamos a cargar más datos, esto indica cuántos más cargamos

/* Esta vez no exportamos una clase sino una función, para que se pueda recibir el parámetro "kindOfView", que determina el tipo de vista, y así
   este mismo código puede utilizarse para representar varias vistas distintas, aunque similares.Como estas vistas no pertenecen al StackNavigator global,
   no puede usarse la técnica de recibir dicho parámetro a través del "payload" al navegar. Los valores de kindOfView pueden ser:

   0 -> Lista de todos los usuarios, ordenados por nombres de usuario
   1 -> Lista de los amigos del usuario actual
   2 -> Lista de los usuarios que le han enviado una solicitud de amistad al actual
   3 -> Lista de todos los usuarios, ordenados por sus identificadores (estó sólo lo ve el administrador)

   La desventaja de esto es que al ir desarrollando es necesario reiniciar la aplicación completa para visualizar los cambios. La recarga en caliente no actualiza.
 */

// Cantidad de registros a cargar cuando se están cargando registros por primera vez en esta vista
const INITIAL_RECORDS = 20;

// Indica si el usuario actual es administrador o no. La dejamos como variable global para que navigationOptions pueda acceder a ella
var IS_ADMIN = false;

export default function ListOfUsers(kindOfView) {
	let drawerIconName = ["address-book", "users", "user-plus", "id-badge"];
	let myClass = (
		class ListOfUsers extends Component {

			constructor(props) {
				super(props)
				this.keyboardDidShow = this.keyboardDidShow.bind(this)
				this.keyboardDidHide = this.keyboardDidHide.bind(this)

				// Establecemos el título que aparece en la cabecera
				this.props.dispatchChangeHeaderTitle(this.props.allMessages[0][kindOfView]);

				this.state = {
					loading:             true, // Booleano que determina si se está intentando leer desde la base de datos
					loadingMoreUsers:    true, // Booleano que se hace verdadero en el momento en que se están leyendo los datos de uno o más usuarios para desplegarlos en la lista que el actual ve
					activateWhenLoading: true, // Indica si cuando la vista dice "Cargando" debemos activar la función de cargar desde la base de datos.
					                           // Si no es necesario, es porque ya otra función la activó
					timesTryingLoading: 0,     // Cantidad de veces que se ha intentado leer los datos desde la base de datos, sin éxito
					loadFunctionOpened: true,  // Indica si se puede ingresar a la función loadData

					filter_name_prov:   "",  /* Almacenará el la cadena de caracteres que ingrese el usuario para filtrar la búsqueda de usuarios, pero no será 
					                              el filtro definitivo porque no queremos hacer una consulta nueva a la base de datos por cada caracter nuevo que se ingrese */
					filter_name:        "",  // Ésta es la cadena definitiva que se tomará en cuenta para filtrar la búsqueda

					friends:            {},  // Objeto con los identificadores de usuario de los que son amigos del actual
					friendRequests:     {made: {}, received: {}},  /* Objeto de a su vez dos objetos: el que tiene los identificadores de usuario de quienes le han hecho una solicitud de amistad al actual,
					                             y los de los que han recibido una solicitud por parte del actual */

					// Lista de objetos referentes a los usuarios que posiblemente se mostrarán en la lista que el usuario ve. Estos objetos sólo almacenan el identificador y el nombre de usuario.
					// Si estamos deslizándonos por esta vista y se requiere cargar más elementos, lo que se hará realmente será cargar más imágenes de perfil pero de los usuarios que ya estaban en esta lista,
					// es decir, no leeremos nuevamente esta lista desde la base de datos. Se optó por esta solución porque es más eficiente, pero tiene la desventaja de que no muestra si un usuario nuevo
					// ingresó en el sistema en este momento, o si por el contrario uno existente se retiró del mismo. Tampoco se cargará de nuevo esta lista al regresar de la ventana "UserView.js".
					// Cuando sí se carga de nuevo es cuando regresamos de otra vista del Drawer Navigator, porque no conservamos el historial de navegación al cambiar de vistas en él.
					databaseUsersList: null,  

					// Lista de todos los usuarios que actualmente el usario puede ver en la lista
					renderedUsersList: [], 

					// Los dos índices siguientes se refieren a los índices mínimo y máximo respectivamente de los elementos de la lista de usuario que en principio
					// se mostrarán desplegados. Decimos "en principio" porque puede que haya menos elementos que mostrar, y por lo tanto los índices no coincidan con
					// los límites reales.
					minIndexToLoad: 0,
					maxIndexToLoad_plusOne: 0,

					// Determina si el teclado está visible.
					keyboardAvailable: false,
				}

				// Aquí es donde determinamos si el usuario actual es administrador o no
				IS_ADMIN = (this.props.privileges == 2);
			}

			// Formato de lo que se ve en el Drawer lateral, referente a esta vista
			static navigationOptions = ({ screenProps }) => {
				if ((kindOfView!=3) || IS_ADMIN){
					return({
						title: ListOfUsers_Texts[screenProps.stackNavigation.getScreenProps().language][0][kindOfView],
						drawerIcon: () => ( <Icon  name={drawerIconName[kindOfView]}  color="black"  size={20}/> ),
					})
				} else {
					// No hay ninguna etiqueta en el Drawer correspondiente a esta vista, por lo que no hay manera de acceder a ella
					return {drawerLabel: () => null}; 
				}
			}

			componentDidMount(){
				// Aquí inicializamos los escuchas que determinan si el teclado se está mostrando o no
				this.keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', this.keyboardDidShow);
				this.keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', this.keyboardDidHide);
			}

			// Caso en que el teclado se está mostrando
			keyboardDidShow() {
				this.setState({keyboardAvailable: true});
			}

			// Caso en que el teclado se ocultó
			keyboardDidHide() {
				this.setState({keyboardAvailable: false});
			}

			// Procedimiento para contablizar un intento fallido de leer la base de datos
			failureReadingDatabase = () => {
				let timesTryingLoading = this.state.timesTryingLoading;

				if (timesTryingLoading < MAXIMUM_RETRIES_LOADING_USERS){
					this.determineConnection(true);	
					timesTryingLoading += 1;
					this.setState({timesTryingLoading})
				}					
			}

			// Función auxiliar de loadData que carga la información correspondiente dependiendo del tipo de vista.
			auxiliarLoadData = async(load_relationships, load_databaseUsersList, load_usersToDisplay) => {
				let s = this.state;
				let success = true;

				// Obtenemos las variables necesarias del estado que posiblemente se cambiarán en esta función
				let {friends, friendRequests, databaseUsersList, renderedUsersList, minIndexToLoad, maxIndexToLoad_plusOne} = this.state;

				if (load_relationships){
					// Obtenemos esas listas desde la base de datos. No lo haremos si estamos cargando más datos al deslizar por esta vista
					await this.props.localDB.get(DEFAULT_DOCUMENT_ID)
						.then(async function(document){
							friends = await document.friends; 
							friendRequests = await document.friendRequests;
						})
						.catch(function(error){
							success = false;
						})
					if (!success){ // Si hubo un error, detenemos la ejecución de esta función
						return success; 
					}
				}

				// Esto se refiere a si tenemos que cargar los objetos que tienen _id y nombre de usuario de los que nos interesan. No recuperamos
				// otras propiedades que puedan estar incluidas en las tablas en el futuro
				if (load_databaseUsersList){
					// Si vamos a cargar esto es porqe vamos a volver a cargar todos los elementos, olvidándonos de los que ya estuviesen listados en la vista,
					// de modo que restauramos los índices y también la lista de los mostrados
					minIndexToLoad         = 0;
					maxIndexToLoad_plusOne = null;
					renderedUsersList      = [];

					await remoteLithodex.get(USERS_TABLES_DOCUMENT_ID)
						.then(async(document) => {

							// Si estamos en la vista de todos los usuarios nos guiamos por la tabla indexada por nombres de usuario
							if (kindOfView == 0){
								let objects = document.userNames;
								databaseUsersList = Object.keys(objects)
									.filter(key => auxiliarFunctions.stringIncludesSubstring_NoStrict(key, s.filter_name))
									.map(key => ({_id: objects[key]._id, userName: key}) );		
							}
							else { // En los otros casos nos guiamos por la tabla indexada por los identificadores de usuario
								let objects = document.userIds;

								switch (kindOfView){
									case 1: // Caso en que estamos en la vista de los amigos del actual
										try {
											databaseUsersList = Object.keys(friends)
												.filter(key => auxiliarFunctions.stringIncludesSubstring_NoStrict(objects[key].userName, s.filter_name))
												.map(key => ({userName: objects[key].userName, _id: key}) );
										} catch(error){
											databaseUsersList = []; // Es necesario colocar esto para indicar que la base de datos fue leída, a pesar de que no hay usuarios que mostrar
										}
										break;

									case 2: // Caso en que estamos en la vista de quienes le han enviado una solicitud de amistad al actual
										try {
											databaseUsersList = Object.keys(friendRequests.received)
												.filter(key => auxiliarFunctions.stringIncludesSubstring_NoStrict(objects[key].userName, s.filter_name))
												.map(key => ({userName: objects[key].userName, _id: key}) );
										} catch(error){
											databaseUsersList = []; // Es necesario colocar esto para indicar que la base de datos fue leída, a pesar de que no hay usuarios que mostrar
										}
										break;

									case 3: // Caso en que estamos en la lista de todos los usuarios ordenados por identificadores (privilegio de administrador)
										try {
											databaseUsersList = Object.keys(objects)
												.filter(key => auxiliarFunctions.stringIncludesSubstring_NoStrict(key, s.filter_name))
												.map(key => ({userName: null, _id: key}) );
										} catch(error){
											databaseUsersList = []; // Es necesario colocar esto para indicar que la base de datos fue leída, a pesar de que no hay usuarios que mostrar
										}
										break;
									default:
										break;
								}
							}
						})
						.catch(function(error){
							// Entramos aquí cuando se produce un error leyendo la base de datos, no cuando no hay usuarios que mostrar
							success = false;
						})
				}

				// Si hubo éxito en lo anterior
				if (success){

					// Caso en que queremos cargar más elementos en la lista que el usuario ve. La única vez que no queremos cargar más usuarios es cuando estamos regresando a la vista de
					// todos los usuarios desde "UserView.js". Ahí nos mantenemos con los que ya estaban.
					if (load_usersToDisplay){
						let userObject, userDatabase; // Variables utilizadas en el ciclo a continuación

						const len_minusOne = databaseUsersList.length;
						maxIndexToLoad_plusOne = (minIndexToLoad == 0) ? Math.min(len_minusOne, INITIAL_RECORDS) : Math.min(len_minusOne, maxIndexToLoad_plusOne);

						if (maxIndexToLoad_plusOne <= len_minusOne) {
							this.setState({loadingMoreUsers: true});
							for (i = minIndexToLoad; i < maxIndexToLoad_plusOne; i++){
								userObject = databaseUsersList[i];

								try {
									userDatabase = await new PouchDB(SERVER_URL + userObject._id, {skip_setup: true}); // El "skip_setup" evita que la base de datos se cree si no existe
									await userDatabase.get(DEFAULT_DOCUMENT_ID)
										.then(async function(userDocument){
											await renderedUsersList.push({_id: userObject._id, userName: userObject.userName, profileImage: userDocument.information.profileImage})
										}) 
								} catch(error){} // Aquí no importa si se obtiene un error cargando un usuario específico, porque aun así se mostrarán otros usuarios
							}
						}

						// En la siguiente carga los índices habrán variado
						this.setState({
							minIndexToLoad:         maxIndexToLoad_plusOne, 
							maxIndexToLoad_plusOne: maxIndexToLoad_plusOne + RECORDS_PER_FETCH,
						});
					}
					this.setState({renderedUsersList, databaseUsersList, friends, friendRequests, timesTryingLoading: 0});	
				}
				return success;		
			}

			/* Procedimiento que verifica la conexión y en caso de que haya llama a una función auxiliar que carga todos los usuarios necesarios 
			   desde la base de datos y los almacena en una variable de estado local

			   Esta forma de recibir parámetros a través de objetos permite que las otras funciones que invocan a ésta no tengan que preocuparse de conocer el orden de los mismos, 
			   y poner el "= {}" permite omitir parámetros a los cuales se les quiere dejar sus valores por defecto:
			   
			   https://stackoverflow.com/questions/894860/set-a-default-parameter-value-for-a-javascript-function
			*/
			loadData = async({dispatchDrawerFunction=false, verifyConnection=true, load_relationships=true, load_databaseUsersList=true, load_usersToDisplay=true} = {}) => {
				this.setState({loadFunctionOpened: false});

				if (dispatchDrawerFunction){
					// Esto hace que el botón de tres líneas que está en la parte derecha de la cabecera pueda abrir el DrawerNavigator. Colocamos esto aquí y no
					// en componentDidMount, donde sólo se ejecutaría una vez, porque al navegar a otras vistas del navegador de pila esta función podría ser
					// reemplazada por alguna otra, y luego al regresar a esta vista no se volvería a recuperar. Actualmente eso no puede pasar en la aplicación, pero
					// podría en el futuro si se añaden otras funcionalidades.
					this.props.dispatchStackScreenPropsFunction(this.props.navigation.openDrawer);
				}

				if (verifyConnection){
					await this.determineConnection();
				}
				
				if (this.state.connectionToServer){
					const success = await this.auxiliarLoadData(load_relationships, load_databaseUsersList, load_usersToDisplay);
					if (!success){
						this.failureReadingDatabase();
					}
				} else {
					this.failureReadingDatabase();
				}

				await this.props.dispatchChangeLoadView(false); // Hacemos que la variable this.props.loadView sea falsa
				await this.setState({loading: false, loadingMoreUsers: false, activateWhenLoading: false});
				this.setState({loadFunctionOpened: true});
			}

			// Esto determina si hay conexión a Internet o no
			async determineConnection(executeLoadData = false, showLoadingMessage = false){
				if (showLoadingMessage){ // Si esto es verdadero es porque el usuario es quien ordenó volver a cargar los datos
					this.setState({loading: true, timesTryingLoading: 0})
				}
				const {isInternetReachable, isConnected} = await Network.getNetworkStateAsync();
				const connectionToServer = isInternetReachable && isConnected;
				await this.setState({connectionToServer});

				if (connectionToServer && executeLoadData){
					this.loadData({verifyConnection: false});
				}
			}

			// Por si acaso desmontamos esta vista antes de que a la función de cargar desde la base de datos le dé tiempo
			// de despachar esta variable como falsa
			componentWillUnmount(){
				this.props.dispatchChangeLoadView(false);
			}

			// Para ir a la vista del usuario que se va a examinar
			goToUserView = (user_id) => {
				const payload = {_id: user_id};
				this.props.screenProps.stackNavigation.navigate({key: 'UserView', routeName: 'UserView', params: payload});
			}

			// Este método cambia el texto por el que se filtran los usuarios, pero sin invocar a la función de carga de datos para efectivamente filtrarlos
			setFilterText = (text) => {
				this.setState({filter_name_prov: text});
			}

			// Una vez que se cambia el texto en el que se filtran los nombres, se invoca este procedimiento
			filterSearch = () => {
				this.setState({filter_name: this.state.filter_name_prov, loading: true}, () => this.loadData({load_relationships: false}));
			}

			// Función para mostrar los usuarios como una lista de botones
			renderUsers() {
				let s = this.state;
				let p = this.props;
				let myList = s.renderedUsersList;

				return (
					<FlatList
						onEndReachedThreshold = {0.05} // Se considera que se ha llegado al final de la lista un poco antes de en realidad haberlo hecho

						// Lo que ocurre cuando llegamos al final de la lista
						onEndReached = {this.state.loadFunctionOpened ? () => {this.loadData({load_relationships: false, load_databaseUsersList: false})} : () => {}}

						ItemSeparatorComponent = {Platform.OS !== 'android' && (({ highlighted }) => (
							<View // Esto aparentemente servirá cuando trabajemos con iOS
								style = {[
									style.separator,
									highlighted && { marginLeft: 0 }
								]}
							/>
						))}
						data         = {myList} // Arreglo con los elementos que queremos listar
						keyExtractor = {(item) => item._id.toString()} // Sirve para indicarle que lo que debe usar como "key" por cada elemento es el atributo "_id"
						renderItem   = {({ item, index, separators }) => (
							<TouchableHighlight
								key            = {item.key}
								onPress        = {() => this.goToUserView(item._id)}
								onShowUnderlay = {separators.highlight}
								onHideUnderlay = {separators.unhighlight}
							>
								<ListItem
									title      = {(null !== item.userName) ? (item.userName) : item._id} // El nombre de usuario es nulo cuando el administrador ve la lista ordenada por identificadores
									key        = {index}
									// Mensajes: "Amigos" "Solicitud de amistad enviada" "Solicitud de amistad pendiente"
									subtitle   = {(kindOfView == 0) ? 
													(s.friends.hasOwnProperty(item._id)) ? ("("+p.allMessages[0][1]+")") :
														( (s.friendRequests.made.hasOwnProperty(item._id)) ? ("("+p.allMessages[3]+")") :
															(s.friendRequests.received.hasOwnProperty(item._id)) ? ("("+p.allMessages[4]+")") : null
														)
													: null
									} 
									leftAvatar = {
										<Avatar
											size   = "medium"
											source = {(item.profileImage !== null) ? {uri: item.profileImage} : DEFAULT_USER_ICON}
										/>
									}
								/>
							</TouchableHighlight>
						)}
						ListFooterComponent = { 
							<View>
								{this.state.loadingMoreUsers &&
									<View style = {{height: '15%', paddingLeft: '10%'}}>
										{/*//Mensaje: "Cargando"*/}
										<Text style = {{fontSize: 16}}>{p.allMessages[1]}...</Text>
									</View>
								}
							</View>
						}
					/>
				)
			}

			// Sirve para activar la función que lee desde la base de datos. Esto es útil cuando estamos emulando la aplicación y refrescamos la página
			// en caliente, ya que hacer eso volverá a colocar this.state.loading en su valor inicial (true) pero este componente ya estará montado, por lo que 
			// no se activará el NavigationEvents onWillFocus, y en consecuencia la vista se quedará pegada en "Cargando"
			activateLoadData(entry){
				if (this.state.loadFunctionOpened){
					this.setState({loadFunctionOpened: false}, () => this.loadData({...entry}));
				}
				return(<View/>)
			}

			// Lo que se le mostrará al usuario
			render() {
				let s = this.state;
				let p = this.props;

				// Caso en que todavía no se ha cargado la información desde la base de datos
				if (s.loading){
					return(
						<View style = {genericStyles.simple_center}>
							{s.activateWhenLoading && this.activateLoadData({dispatchDrawerFunction: true})}
							<ActivityIndicator size = "large" color = "#0000ff" />
							{/*Mensaje: "Cargando"*/}
							<Text>{p.allMessages[1]}...</Text>
						</View>
					)
				}

				// Indica si ya se logró leer información desde la base de datos
				const databaseWasRead = (this.state.databaseUsersList !== null); 

				// Indica si hay usuarios posibles que desplegar en la lista. Será verdadero incluso si el filtro de búsqueda que introduce el usuario
				// hace que no queden elementos para desplegar
				const thereAreUsersLoaded = databaseWasRead && (this.state.databaseUsersList.length > 0);

				// Indica que el usuario no tiene amigos añadidos
				const noAddedFriends = auxiliarFunctions.isEmptyObject(s.friends);

				// Indica que el usuario no tiene solicitdes pendientes
				const noPendingFriendRequests = auxiliarFunctions.isEmptyObject(s.friendRequests.received);

				// Indica si estamos en una de las vistas donde se muestran todos los usuarios
				const allUsersView = ((kindOfView == 0) || (kindOfView == 3));

				// Caso en que ya se han cargado los usuarios
				return (
					<View style = {genericStyles.lightGray_background}>

						{/*Caso en que regresamos de una vista del StackNavigator. Nótese que no volvemos a obtener todos los identificadores junto con nombres de usuario
						  si estamos en la lista de todos los usuarios, pero sí lo hacemos en las otras vistas. Eso significa que si regresamos a la vista de todos los usuarios,
						  tenemos que indicar que no queremos que se carguen nuevamente los datos*/}
						{this.props.loadView && this.activateLoadData({dispatchDrawerFunction: true, load_databaseUsersList: !allUsersView, load_usersToDisplay: !allUsersView})}

						{/*Parte en la que el usuario ve la lista de otros usuarios*/}
						<View style = {{...genericStyles.white_background_without_ScrollView, flex: 1}}>

							{/*Aquí el usuario puede filtrar la búsqueda del otro usuario a buscar*/}
							<SearchBar
								value                = {s.filter_name_prov}
								selectTextOnFocus    = {true}
								lightTheme           = {true}
								textAlign            = {'center'} 
								inputStyle           = {{color: 'black', backgroundColor: WHITE_COLOR}}
								placeholder          = {p.allMessages[2][kindOfView]} // Mensaje: "Buscar [usuarios/amigos/solicitudes]..."
								placeholderTextColor = {'gray'}
								onChangeText         = {text => this.setFilterText(text)}
								searchIcon           = {{
									onPress: () => this.filterSearch(),
									containerStyle: <View style = {{flex: 1}}/>
								}}
							/>

							{!databaseWasRead && // Cuando no hay conexión y no se han cargado usuarios, se muestra un botón que permite intentar cargarlos nuevamente
								<View style = {{...genericStyles.simple_center, flexDirection: 'column', paddingBottom: (s.keyboardAvailable ? 0 : '20%')}}>
									{/*Mensaje: "Ocurrió un error"*/}
									<Text style = {{textAlign: 'center'}}>{p.allMessages[5]}</Text>

									<View style = {{height: 30}}/>

									<ButtonWithIcon
										raised
										icon    = {{name: 'cached'}}
										title   = {p.allMessages[6]} // Mensaje: "Volver a intentarlo"
										onPress = {() => this.determineConnection(true, true)}
									/>	
								</View>
							}

							{/*En este caso debe mostrarse un mensaje de que no hay usuarios (amigos o solicitudes pendientes)
							   Esto nunca se muestra en la vista correspondiente a todos los usuarios, porque en el sistema siempre 
							   hay al menos un usuario registrado, como el que está viendo la lista */}
							{databaseWasRead && (((kindOfView == 1) && noAddedFriends) || ((kindOfView == 2) && noPendingFriendRequests)) &&
								<View style = {{...genericStyles.simple_center, flexDirection: 'column', paddingBottom: (s.keyboardAvailable ? 0 : '20%')}}>
									{/*Mensajes: "No se han añadido amigos todavía" "No hay solicitudes de amistad pendientes"*/}
									<Text style = {{textAlign: 'center'}}>{p.allMessages[7][kindOfView]}</Text>	
								</View>
							}

							{/*Caso en que el filtro de búsqueda eliminó todas las posibles coincidencias*/}
							{databaseWasRead && (!thereAreUsersLoaded) && 
								( allUsersView // Cuando la lista es la de todos los usuarios, si no hay elementos necesariamente es porque fueron descartados por el filtro
									|| ((kindOfView == 1) && (!noAddedFriends)) 
									|| ((kindOfView == 2) && (!noPendingFriendRequests))
								) && 

								<View style = {{...genericStyles.simple_center, paddingBottom: (s.keyboardAvailable ? 0 : '20%')}}>
									{/*Mensajes: "No se encontraron coincidencias"*/}
									<Text style = {{textAlign: 'center'}}>{p.allMessages[8]}</Text>	
								</View>		
							}

							{thereAreUsersLoaded && // Caso en que hay usuarios disponibles para mostrar
								<View style = {localStyles.userPicker}>
									{this.renderUsers()}
								</View>						
							}

						</View>
					</View>
				); 
			}
		}
	)

	/// Función para obtener las variables deseadas desde el estado global de la tienda Redux
	const mapStateToProps = (state) => {
		return {
			allMessages: ListOfUsers_Texts[state.appPreferencesReducer.language], 
			user_id:     state.userReducer.user_id,
			privileges:  state.userReducer.privileges,
			localDB:     state.userReducer.localDB,
			loadView:    state.popUpReducer.loadView,
		}
	};

	const mapDispatchToProps = (dispatch) => {
		return {
			dispatchChangeLoadView: (bool) => dispatch(changeLoadView(bool)),
			dispatchStackScreenPropsFunction: (globalFunction) => dispatch(changeStackScreenPropsFunction(globalFunction)),
			dispatchChangeHeaderTitle: (title) => dispatch(changeHeaderTitle(title)),
		}
	};

	return connect(mapStateToProps, mapDispatchToProps)(myClass);
}

// Constante para darle formato a los diversos componentes de esta pantalla
const localStyles = StyleSheet.create({

	// Formato para mostrar un usuario (no la lista completa, sino uno específico)
	userPicker: {
		flex:          8,
		flexDirection: 'column',
		padding:       10,
	},
});