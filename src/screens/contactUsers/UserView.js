import React, { Component } from 'react'
import { Text, View, StyleSheet, TextInput, ScrollView, TouchableHighlight, Alert,
		Modal, ActivityIndicator, Image, FlatList, Button as ButtonNoIcon} from 'react-native'

import { Avatar, ListItem, Button as ButtonWithIcon} from "react-native-elements"

import * as MailComposer from 'expo-mail-composer';
import * as Network from 'expo-network'

import Icon from 'react-native-vector-icons/FontAwesome';

import ImageZoom from 'react-native-image-pan-zoom'

import { NavigationEvents } from 'react-navigation'

import { connect } from 'react-redux'
import { changeLoadView } from '../../redux/actions/popUpActions'
import { changeUserName, changeUserProfileImage, changeUserPrivileges } from '../../redux/actions/userActions'
import { UserView_Texts } from '../../languages/screens/contactUsers/UserView'

import * as Log              from '../../genericFunctions/logFunctions'
import * as Database         from '../../genericFunctions/databaseFunctions'
import * as contactFunctions from '../../genericFunctions/contactUsersFunctions'
import * as D                from '../../constants/Dimensions'
import { genericStyles, DARK_GRAY_COLOR, ORANGE_COLOR } from '../../constants/genericStyles'
import { DEFAULT_DOCUMENT_ID, SERVER_URL, PRIMARY_ADMINISTRATOR_ID } from '../../constants/appConstants'

import * as auxiliarFunctions from '../../genericFunctions/otherFunctions'
import {DEFAULT_USER_ICON} from '../../constants/genericImages'

import PouchDB from 'pouchdb-react-native'


// Máxima cantidad de veces que se puede volver a intentar cargar automáticamente los datos desde la base de datos.
// Si es el usuario el que solicita volver a cargar a través del botón correspondiente en la vista, el contador se reinicia a cero
const MAXIMUM_RETRIES_LOADING = 3; 

class UserView extends Component {

	constructor(props) {
		super(props)

		// Identificador del usuario que se va a visalizar en este momento
		const examinedUser_id = this.props.navigation.getParam('_id');

		this.state = {		
			examinedUser_id,

			// Base de datos del usuario que se va a visualizar en este momento. El "skip_setup" evita que la base de datos se cree si no existe
			examinedUser_DB: new PouchDB( ((examinedUser_id!==this.props.user_id) ? SERVER_URL + examinedUser_id : examinedUser_id), {skip_setup: true}),

			loading:             true, // Determina si se está cargando la información necesaria desde la base de datos
			activateWhenLoading: true, // Indica si cuando la vista dice "Cargando" debemos activar la función de cargar desde la base de datos.
			                           // Si no es necesario, es porque ya otra función la activó
			timesTryingLoading:  0,    // Cantidad de veces que se ha intentado leer los datos desde la base de datos, sin éxito
			loadFunctionOpened:  true, // Indica si se puede ingresar a la función loadDatabaseInformation

			databaseWasRead: false, // Indica que la base de datos ya fue leída, y por lo tanto se cargó la información del usuario necesaria

			// Determina si los botones pueden ejecutar sus respectivas funciones, lo cual impide que se presione el mismo botón 
			// por accidente dos veces seguidas, o dos botones contradictorios
			buttonsEnabled: true,

			modalVisible:        false, // Determina si está visible o no el modal que permite visualizar la imagen del perfil
			profileImage_width:  null, // Anchura original de la imagen de perfil
			profileImage_height: null, // Altura original de la imagen de perfil

			/* Las siguientes variables determinan la relación que tiene el usuario que se está examinando con el usuario actual
			   Nota que sólo una de ellas puede ser "true" al mismo tiempo */
			currentUserSentRequest: false, // Indica si el usuario actual le llegó a enviar una solicitud de amistad al usuario examinado
			hasRequestOnUser:       false, // Indica si el usuario examinado le ha enviado una solicitud de amistad al usuario actual
			isFriend:               false, // Indica si es amigo del usuario actual
			isTheSameUser:          false, // Indica si el usuario examinado es el mismo que está usando la aplicación
		}
	}

	// Formato de la cabecera de la vista
	static navigationOptions = ({ screenProps }) => ({
		title:           UserView_Texts[screenProps.language][0],
		headerTintColor: screenProps.headerTintColor,
		headerStyle: {
			backgroundColor: screenProps.headerBackgroundColor,
			...genericStyles.navigationHeader,
		}
	});

	// Procedimiento para contablizar un intento fallido de leer la base de datos
	failureReadingDatabase = () => {
		let timesTryingLoading = this.state.timesTryingLoading;

		if (timesTryingLoading < MAXIMUM_RETRIES_LOADING){
			this.determineConnection(true);	
			timesTryingLoading += 1;
			this.setState({timesTryingLoading})
		}					
	}

	// Aquí cargamos la información relevante del usuario que estamos examinando, así como también del usuario actual
	async loadDatabaseInformation(verifyConnection = true){
		let p = this.props;
		let s = this.state;

		this.setState({buttonsEnabled: true});

		if (verifyConnection){
			await this.determineConnection();
		}

		if (this.state.connectionToServer){
			await s.examinedUser_DB.get(DEFAULT_DOCUMENT_ID)
				.then(async(examinedUser_document) => {  

					// Caso en que el usuario examinado es el mismo actual
					if (s.examinedUser_id === p.user_id){
						// Si dejamos como campo "_id" el que se recupera de "examinedUser_document", 
						// no obtendremos el "_id" del usuario sino el de este docmento: <DEFAULT_DOCUMENT_ID>
						examinedUser_document._id = p.user_id;
						
						await this.setState({
							currentUser: examinedUser_document, // Almacenamos aquí los datos del usuario actual para poder pasárselos directamente
						                                        // a "UserForm.js", y así esa vista no tiene que volver a acceder a la base de datos
							isTheSameUser: true,
						});

						// Volvemos a despachar las variables necesarias a la Tienda Redux por si acaso cambiaron en otra sesión abierta
						p.dispatchUserName(examinedUser_document.userName);
						p.dispatchProfileImage(examinedUser_document.information.profileImage);
						p.dispatchPrivileges(examinedUser_document.privileges);
					} 
					else {
						// También necesitamos la información del usuario que está utilizando la aplicación
						await p.localDB.get(DEFAULT_DOCUMENT_ID)
							.then(async(currentUser_document) => {

								let currentUserSentRequest, hasRequestOnUser, isFriend;
								currentUserSentRequest = hasRequestOnUser = isFriend = false;

								if (currentUser_document.friendRequests.made.hasOwnProperty(s.examinedUser_id)){
									currentUserSentRequest = true;
								} 
								else if (currentUser_document.friendRequests.received.hasOwnProperty(s.examinedUser_id)) {
									hasRequestOnUser = true;
								}
								else if (currentUser_document.friends.hasOwnProperty(s.examinedUser_id)) {
									isFriend = true;
								}
								this.setState({currentUserSentRequest, hasRequestOnUser, isFriend})

								// Volvemos a despachar las variables necesarias a la Tienda Redux por si acaso cambiaron en otra sesión abierta
								p.dispatchUserName(currentUser_document.userName);
								p.dispatchProfileImage(currentUser_document.information.profileImage);
								p.dispatchPrivileges(currentUser_document.privileges);
							})
							.catch(error => {
								this.failureReadingDatabase();
							})
					}

					// Almacenamos la información del usuario examinado
					const info = examinedUser_document.information;
					await this.setState({
						// Privilegios del usuario que se está examinando
						userPrivileges:    examinedUser_document.privileges,

						// Información visible para todos los usuarios
						userName:          examinedUser_document.userName,
						profileImage:      info.profileImage,
						firstName:         info.firstName,
						firstSurname:      info.firstSurname,
						profession:        info.profession,

						// Información a la que sólo tienen acceso los amigos o el usuario propio cuando se examina a sí mismo
						examinedUserEmail: info.email,
						officePhoneNumber: info.officePhoneNumber,
						mobilePhoneNumber: info.mobilePhoneNumber,
					});
					
					this.databaseSuccessfullyRead();

				}).catch(error => {
					this.failureReadingDatabase();
				})
		} else {
			this.failureReadingDatabase();
		}
		await this.setState({loading: false, activateWhenLoading: false});
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
			this.loadDatabaseInformation(false);
		}
	}

	databaseSuccessfullyRead(){
		this.setState({databaseWasRead: true});

		let s = this.state;
		if (s.profileImage != null){
			Image.getSize(s.profileImage, (width, height) => {
				this.setState({
					profileImage_width:  width, 
					profileImage_height: height,	
				})
			})	
		}
	}

	componentWillUnmount(){
		// Hacemos que la vista que llamó a ésta cargue de nuevo
		this.props.dispatchChangeLoadView(true);
	}

	// Determina si debe mostrarse o no el modal que permite visualizar con detalle la imagen de perfil
	setModalVisible = (isVisible) =>{
		this.setState({modalVisible: isVisible});
	}

	// Procedimiento para enviar un correo
	sendEmail = async() => {
		// Esto determina si es posible usar el MailComposer en este dispositivo
		var isAvailable = await MailComposer.isAvailableAsync();

		this.setState({buttonsEnabled: true});

		if (isAvailable){
			MailComposer.composeAsync({recipients: [this.state.examinedUserEmail]});
		}
		else { // En caso de que no se pueda usar el MailComposer, usamos esta otra función

			/* Nota: Dicen en Internet que este método no permite adjuntar archivos, pero haciendo pruebas se verificó que al menos
			   en Android sí se logra. Ello porque esta función nos lleva a una nueva interfaz (ajena a la aplicación) en la
			   que hay un botón para adjuntar archivo. Lo que sí es cierto es que no podemos adjuntarlo directamente desde
			   aquí, pasándolo como parámetro */
			contactFunctions.SendEmailQS(this.state.examinedUserEmail, "", "");
		}
	}

	// Función para dirigirse a la ventana de edición de perfil
	editProfile = () => {
		this.props.navigation.navigate({ key: 'UserForm', routeName: 'UserForm', params: this.state.currentUser});
	}

	// Para retornar a la lista de usuarios correspondiente
	returnToPreviousScreen = () => {
		if (this.state.buttonsEnabled){
			this.setState({buttonsEnabled: false});
			this.props.navigation.goBack();
		}
	}

	// Función para indicar que ocurrió un error al tratar de actualizar la relación de amistad entre el usuario actual y el examinado
	// (envió solicitud, rechazó solicitud, la aprobó, etc.)
	alertError(){
		// Alerta: "Ocurrió un error"
		Alert.alert(p.allMessages[15], p.allMessages[20]);
		this.setState({buttonsEnabled: true});
		this.loadDatabaseInformation();
	}

	// Para rechazar una solicitud de amistad
	rejectFriendRequest = async(kind) => {
		let s = this.state;
		let p = this.props;

		// Quien había enviado la solicitud es el usuario que ahora se está examinando
		const result = await Database.updateRelationship(s.examinedUser_id, p.user_id, s.examinedUser_DB, p.localDB, kind);

		if (result.noError){
			this.setState({hasRequestOnUser: false, buttonsEnabled: true});
			// Alerta: "Solicitud de amistad rechazada"
			Alert.alert(p.allMessages[15], p.allMessages[27]);
		} else {
			this.alertError();
		}
	}

	// Para eliminar a otro usuario de la lista de amigos
	deleteFriend = async(kind) => {
		let s = this.state;
		let p = this.props;

		// Aquí no importa el orden en que pasemos los dos primeros parámetros
		const result = await Database.updateRelationship(p.user_id, s.examinedUser_id, p.localDB, s.examinedUser_DB, kind);

		if (result.noError){
			this.setState({isFriend: false, buttonsEnabled: true});
			// Alerta: "El usuario fue removido de su lista de amigos"
			Alert.alert(p.allMessages[15], p.allMessages[28]);
		} else {
			this.alertError();
		}
	}

	/* Función para actualizar la relación de amistad que hay entre los dos usuarios. La acción que realiza depende del valor de "kind"

		* Si kind = 0, un usuario le está haciendo una solicitud de amistad a otro.
		* Si kind = 1, se está eliminando una solicitud de amistad. 
		    Si el mismo que la había hecho fue el que la canceló, refuseType será igual a 0.
		    Si quien está cancelando la solicitud es quien la había recibido, refuseType será igual a 1.
		* Si kind = 2, se está aprobando una solicitud de amistad.
		* Si kind = 3, se está eliminando a otro usuario de la lista de amigos
	*/
	localUpdateRelationShip = async(kind, refuseType = 0) => {
		let p = this.props;
		let s = this.state;

		// Nota: Recuerda que siempre el primer argumento de la función "Database.updateRelationship" es quien originalmente
		// envió la solicitud, así que el orden en que se pasan los parámetros no siempre es el mismo

		if (kind == 0){ // Caso en que se le envió una solicitud de amistad a otro usuario

			// Quien envió la solicitud es el usuario actual
			const result = await Database.updateRelationship(p.user_id, s.examinedUser_id, p.localDB, s.examinedUser_DB, kind);

			if (result.noError){
				// Efectivamente se terminó enviando una solicitud
				if (result.originalOp){
					this.setState({currentUserSentRequest: true, buttonsEnabled: true});
					// Alerta: "La solicitud de amistad fue enviada"
					Alert.alert(p.allMessages[15], p.allMessages[23]);
				}
				// En este caso los usuarios terminaron siendo amigos directamente, porque el otro también le había enviado una solicitud al actual
				else{
					this.setState({isFriend: true, buttonsEnabled: true});
					// Alerta: "El usuario también había hecho una solicitud, por lo que ambos son ahora amigos"
					Alert.alert(p.allMessages[15], p.allMessages[24]);
				}
			} else {
				this.alertError();
			}
		}
		else if (kind == 1){ // Caso en que se está eliminando una solicitud de amistad

			if (refuseType == 0){ // Caso en que el mismo que había hecho la solicitud la está cancelando

				// Quien había enviado la solicitud es el usuario actual
				const result = await Database.updateRelationship(p.user_id, s.examinedUser_id, p.localDB, s.examinedUser_DB, kind);

				if (result.noError){
					this.setState({currentUserSentRequest: false, buttonsEnabled: true});
				} else {
					this.alertError();
				}
			} 
			else { // Caso en que el usuario actual está rechazando una solicitud que otro le había hecho

				// Alerta: "¿Seguro de que desea rechazar la solicitud?"
				Alert.alert(p.allMessages[15], p.allMessages[18],
					[
						// Mensaje: "Sí"
						{text: p.allMessages[16], onPress: () => this.rejectFriendRequest(kind)},
						// Mensaje: "No"
						{text: p.allMessages[17], onPress: () => this.setState({buttonsEnabled: true})},
					] 
				)
			}
		} else if (kind == 2){ // Caso en que se está aprobando una solicitud de amistad

			// Quien había enviado la solicitud es el usuario que ahora se está examinando
			const result = await Database.updateRelationship(s.examinedUser_id, p.user_id, s.examinedUser_DB, p.localDB, kind);

			if (result.noError){
				if (result.originalOp){
					this.setState({hasRequestOnUser: false, isFriend: true, buttonsEnabled: true});
					// Alerta: "Ahora son amigos"
					Alert.alert(p.allMessages[15], p.allMessages[25]);
				} else {
					this.setState({hasRequestOnUser: false, buttonsEnabled: true});
					// Alerta: "El usuario había cancelado la solicitud previamente"
					Alert.alert(p.allMessages[15], p.allMessages[26]);
				}
				
			} else {
				this.alertError();
			}
		}
		else { // Caso en que los dos usuarios dejaron de ser amigos

			// Alerta: "¿Seguro de que desea eliminar a este usuario de su lista de amigos?"
			Alert.alert(p.allMessages[15], p.allMessages[19],
				[
					// Mensaje: "Sí"
					{text: p.allMessages[16], onPress: () => this.deleteFriend(kind)},
					// Mensaje: "No"
					{text: p.allMessages[17], onPress: () => this.setState({buttonsEnabled: true})},
				] 
			)
		}
	}

	// Para conceder o quitar el privilegio de ser administrador. Nótese que un administrador se puede quitar el privilegio a sí mismo, y 
	// también se lo puede quitar a otros administradores, menos al primario, que es el que viene por defecto en la aplicación.
	// También nótese que esto no toma en cuenta el privilegio de valor 1, que no está implementado actualmente pero podría en el futuro
	changeAdminPrivileges = async(examinedUserIsAdmin) => {
		let p = this.props;

		// Procedimiento para cambiar el privilegio una vez que el usuario ha confirmado qe desea hacerlo
		let auxiliar = async(p, examinedUserIsAdmin) => {
			let newPrivileges = examinedUserIsAdmin ? 0 : 2;
			let noError = await Database.changeAdminPrivileges(newPrivileges, this.state.examinedUser_DB);

			if (noError){
				if (newPrivileges == 2){
					// Alerta: "Se le ha concedido el privilegio de administrador al usuario"
					Alert.alert(p.allMessages[15], p.allMessages[32]);
				} else {
					// Alerta: "Se le ha retirado el privilegio de administrador al usuario"
					Alert.alert(p.allMessages[15], p.allMessages[33]);
				}
				this.setState({buttonsEnabled: true, userPrivileges: newPrivileges});

			} else {
				this.alertError();
			}
		}

		// Alerta: "¿Seguro de que desea cambiar los privilegios de este usuario?"
		Alert.alert(p.allMessages[15], p.allMessages[34],
			[
				// Mensaje: "Sí"
				{text: p.allMessages[16], onPress: () => auxiliar(p, examinedUserIsAdmin)},
				// Mensaje: "No"
				{text: p.allMessages[17], onPress: () => this.setState({buttonsEnabled: true})},
			] 
		)	
	}

	// Ventana para visualizar la imagen del perfil, permitiendo hacerle zoom
	modalView(){
		let s = this.state;
		let p = this.props;

		return(
			<View>
				<Modal
					animationType  = "fade"
					transparent    = {false}
					visible        = {s.modalVisible}
					onRequestClose = {() => this.setModalVisible(false)}
				>
					<View style = {genericStyles.lightGray_background}>

						{/*Aquí se visualiza la imagen menos el botón para volver*/}
						<View style = {genericStyles.white_background_with_ScrollView}>

							{/*Imagen mostrada*/}
							<View style = {localStyles.imageView}>
								<ImageZoom 
									cropWidth   = {0.9 * D.GLOBAL_SCREEN_WIDTH}  // Ancho del área operativa
									cropHeight  = {0.8 * D.GLOBAL_SCREEN_HEIGHT} // Alto del área operativa
									imageWidth  = {s.profileImage_width}  // Ancho de la imagen a mostrar
									imageHeight = {s.profileImage_height} // Alto de la imagen a mostrar
									enableCenterFocus = {false} // Si se deja esto en "true", siempre se enfoca el centro de la imagen
									minScale    = {1/100}
								>
									<Image 
										source = {{uri: s.profileImage}}
										style  = {{width: s.profileImage_width, height: s.profileImage_height}}
									/>
								</ImageZoom> 
							</View>
						</View>

						{/*// Botón para regresar a la vista anterior */}
						<View style = {genericStyles.down_buttons}>
							<ButtonNoIcon
								raised
								color   = {DARK_GRAY_COLOR}
								title   = {p.allMessages[1]} // Mensaje: "Volver"
								onPress = {() => this.setModalVisible(false)}
							/>
						</View>
					</View>
				</Modal>
			</View>
		)
	}

	// Formato de los campos de información que se muestran del usuario, como nombre, profesión, etc.
	// Nótese que sólo se muestra el campo si la variable no es nula
	informationField(message, variable){
		if (variable === null){
			return (<View/>)
		}
		return (
			<View style = {genericStyles.row_instructions_textInput}>
				<Text style = {localStyles.textFields}>{message}: </Text>
				<Text>{variable}</Text>
			</View>
		)
	}

	/// Formato de los botones que aparecen centrados en la vista
	centeredButton = (message, functionToApply, iconName, colorName=null) => {

		// Caso en que usamos botones sin iconos, pero con color escogido
		if (iconName === null){
			return (
				<View style = {localStyles.buttonView}> 
					<ButtonNoIcon
						raised
						title   = {message}
						onPress = {this.state.buttonsEnabled ? () => {this.setState({buttonsEnabled: false}, () => functionToApply())} : () => {}}
						color   = {colorName}
					/>
				</View>
			)
		} 

		/// Caso en que usamos botones con iconos
		return(
			<View style = {localStyles.buttonView}> 
				<ButtonWithIcon
					raised
					title   = {message}
					onPress = {this.state.buttonsEnabled ? () => {this.setState({buttonsEnabled: false}, () => functionToApply())} : () => {}}
					icon    = {{name: iconName}}
				/>
			</View>
		)
	}

	/// Sirve para activar la función que lee desde la base de datos. Esto es útil cuando estamos emulando la aplicación y refrescamos la página
	// en caliente, ya que hacer eso volverá a colocar this.state.loading en su valor inicial (true) pero este componente ya estará montado, por lo que 
	// no se activará el NavigationEvents onWillFocus, y en consecuencia la vista se quedará pegada en "Cargando"
	activateLoadDatabaseInformation(){
		if (this.state.loadFunctionOpened){
			this.setState({loadFunctionOpened: false}, () => this.loadDatabaseInformation());
		}
		return(<View/>)
	}

	// Lo que se le mostrará al usuario
	render(){
		let s = this.state;
		let p = this.props;

		let examinedUserIsAdmin = (s.userPrivileges == 2);

		// Caso en que todavía se está cargando información desde la base de datos
		if (this.state.loading){
			return(
				<View style = {genericStyles.simple_center}>
					{s.activateWhenLoading && this.activateLoadDatabaseInformation()}
					<ActivityIndicator size = "large" color = "#0000ff" />
					{/*Mensaje: "Cargando"*/}
					<Text>{p.allMessages[2]}...</Text>
				</View>		
			)
		}

		// Caso en que ya se cargó la información necesaria desde la base de datos
		return(
			<View style = {genericStyles.lightGray_background}>
				<NavigationEvents onWillFocus = {payload => this.loadDatabaseInformation()}/>

				{/*Ventana del modal*/}
				{this.modalView()}

				{!s.databaseWasRead && // Cuando no hay conexión y no se ha logrado cargar la información del usuario, se muestra un botón que permite intentar cargarlos nuevamente
					<View style = {{...genericStyles.simple_center, flexDirection: 'column'}}>
						{/*Mensaje: "Ocurrió un error"*/}
						<Text style = {{textAlign: 'center'}}>{p.allMessages[20]}</Text>

						<View style = {{height: 30}}/>

						<ButtonWithIcon
							raised
							icon    = {{name: 'cached'}}
							title   = {p.allMessages[21]} // Mensaje: "Volver a intentarlo"
							onPress = {() => this.determineConnection(true, true)}
						/>	
					</View>
				}

				{s.databaseWasRead && // Ésta es la parte principal, en la que está la imagen de perfil, la información de usuario, el botón para añadir o quitar de amigos, etc.
					<View style = {genericStyles.white_background_with_ScrollView}>
						<ScrollView>

							{/*Título que se muestra en la parte superior, indicando el nombre de usuario (que no es necesariamente el nombre real)*/}
							<Text style = {{...genericStyles.subtitle, fontSize: 25}}>{s.userName}</Text>

							<View style = {{justifyContent: 'center', alignItems: 'center', paddingTop: 20, paddingBottom: 20}}>
								{/*//Aquí mostramos la imagen del perfil*/}
								{(s.profileImage != null) &&
									<View>
										<TouchableHighlight 
											onPress = {() => {this.setModalVisible(true)}} 
											style   = {localStyles.touchableHighlight_NoBorder}
										>
											<Image 
												resizeMethod = "auto"
												source       = {{ uri: s.profileImage }}
												style        = {localStyles.touchableHighlight_WithBorder}
											/>
										</TouchableHighlight>
									</View>
								}

								{(s.profileImage == null) &&
									<View>
										<Avatar
											source         = {DEFAULT_USER_ICON}
											containerStyle = {localStyles.touchableHighlight_WithBorder}
										/>
									</View>
								}
							</View>

							{/*Mensaje: "Nombre"*/}
							{this.informationField(p.allMessages[3], s.firstName)}

							{/*Mensaje: "Apellido"*/}
							{this.informationField(p.allMessages[4], s.firstSurname)}

							{/*Mensaje: "Profesión"*/}
							{this.informationField(p.allMessages[5], s.profession)}

							{(s.isFriend || s.isTheSameUser) && /// Aquí colocamos lo que aparece tanto cuando el usuario examinado es el mismo actual, o cuando es su amigo
								<View>

									{/*Mensaje: Teléfono de oficina"*/}
									{this.informationField(p.allMessages[6], s.officePhoneNumber)}

									{/*Mensaje: Teléfono móvil"*/}
									{this.informationField(p.allMessages[7], s.mobilePhoneNumber)}

									{/*Mensaje: "Enviar correo"*/}
									{this.centeredButton(p.allMessages[8], this.sendEmail, 'mail')}

								</View>
							}

							{(s.isFriend) && /// Aquí colocamos lo que debe aparecer sólo cuando el usuario examinado es amigo del actual
								<View> 
									{/*Mensaje: "Eliminar de amigos"*/}
									{this.centeredButton(p.allMessages[14], () => this.localUpdateRelationShip(3), null, 'red')}
								</View>
							}

							{(s.isTheSameUser) && /// Aquí colocamos lo que debe aparecer sólo cuando el usuario actual es el mismo examinado
								<View> 
									{/*Mensaje: "Editar perfil"*/}
									{this.centeredButton(p.allMessages[9], this.editProfile, 'create')}
								</View>
							}

							{(!s.isFriend && !s.isTheSameUser) && /// En esta parte va lo que se muestra cuando el usuario examinado no es amigo del actual, ni es él mismo
								<View>
									{(s.hasRequestOnUser) && // Caso en que el usuario examinado le hizo una solicitud al actual
										<View>
											{/*Mensaje: "Aceptar solicitud de amistad"*/}
											{this.centeredButton(p.allMessages[10], () => this.localUpdateRelationShip(2), null, 'green')}

											{/*Mensaje: "Rechazar solicitud de amistad"*/}
											{this.centeredButton(p.allMessages[11], () => this.localUpdateRelationShip(1,1), null, 'red')}
										</View>
									}

									{(s.currentUserSentRequest) && /// Caso en que el usuario actual le había hecho una solicitud al examinado
										<View> 
											{/*Mensaje: "Cancelar solicitud de amistad"*/}
											{this.centeredButton(p.allMessages[12], () => this.localUpdateRelationShip(1,0), null, 'red')}
										</View>
									}

									{(!s.hasRequestOnUser && !s.currentUserSentRequest) && /// Caso en que el usuario actual y el examinado no se habían hecho solicitudes entre sí
										<View> 
											{/*Mensaje: "Añadir a amigos"*/}
											{this.centeredButton(p.allMessages[13], () => this.localUpdateRelationShip(0), 'person-add')}
										</View>
									}
								</View>
							}

							{(p.privileges == 2) && // En esta parte va lo que se le muestra a un administrador
								<View style = {{borderTopColor: 'gray', borderTopWidth: 0.5, paddingTop: 20}}>
									{/*Mensaje: "Sección para administrador"*/}
									<Text style = {{...genericStyles.subtitle, fontSize: 17}}>{p.allMessages[29]}</Text>

									{/*//Mensaje: "Id de usuario"*/}
									{this.informationField(p.allMessages[22], s.examinedUser_id)}

									{/*Mensajes: "Convertir en administrador" "Eliminar privilegio de administrador"*/}
									{(s.examinedUser_id !== PRIMARY_ADMINISTRATOR_ID) && 
										this.centeredButton(p.allMessages[30 + examinedUserIsAdmin], () => this.changeAdminPrivileges(examinedUserIsAdmin), null, (examinedUserIsAdmin ? 'red' : ORANGE_COLOR))
									}
								</View>
							}

						</ScrollView>
					</View>
				}

				{/*//Botón para regresar a la vista anterior */}
				<View style = {genericStyles.down_buttons}>
					<ButtonNoIcon 
						raised
						title   = {p.allMessages[1]} // Mensaje: "Volver"
						color   = {DARK_GRAY_COLOR}
						onPress = {this.state.buttonsEnabled ? () => {this.returnToPreviousScreen()} : () => {}}
					/>
				</View>
			</View>
		)
	}
}

/// Constante para darle formato a los diversos componentes de esta pantalla
const localStyles = StyleSheet.create({

	// Formato de la vista en la que se muestra una imagen con sus dimensiones originales (Modal 2)
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

	// Formato de los textos que indican el nombre de un campo a mostrar del usuario
	textFields: {
		fontWeight: 'bold',
		color:      'blue',
	},

	// Formato de los botones para añadir como amigo, aprobar una solicitud existente, dejar de ser amigo de alguien, o editar el propio perfil
	buttonView: {
		flex:           1, 
		alignItems:     'center', 
		justifyContent: 'center',
		padding:        15,
	},

	/* Formato del cuadro en donde irá el TouchableHighlight (aunque todavía no ejercerá acción) donde luego se mostrará la foto de perfil, 
	   encima de los botones de agregar desde galería y tomar nueva foto. También es el formato de la imagen ya creada*/
	touchableHighlight_WithBorder: {
		height:         0.7 * D.GLOBAL_SCREEN_WIDTH, 
		width:          0.7 * D.GLOBAL_SCREEN_WIDTH, 
		borderColor:    'black', 
		borderWidth:    1,
	},

	// Formato del TouchableHighlight en donde se muestra la foto de perfil, encima de los botones de agregar desde galería y tomar nueva foto
	touchableHighlight_NoBorder: {
		height:         0.7 * D.GLOBAL_SCREEN_WIDTH, 
		width:          0.7 * D.GLOBAL_SCREEN_WIDTH, 
	},
});

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		allMessages: UserView_Texts[state.appPreferencesReducer.language], 
		user_id:     state.userReducer.user_id,
		localDB:     state.userReducer.localDB,
		privileges:  state.userReducer.privileges,
	}
};

const mapDispatchToProps = (dispatch) => {
	return {
		dispatchChangeLoadView: (bool) => dispatch(changeLoadView(bool)),
		dispatchUserName:       (userName) => dispatch(changeUserName(userName)),
		dispatchProfileImage:   (profileImage) => dispatch(changeUserProfileImage(profileImage)),
		dispatchPrivileges:     (privileges) => dispatch(changeUserPrivileges(privileges)),
	}
};

export default connect(mapStateToProps, mapDispatchToProps)(UserView);