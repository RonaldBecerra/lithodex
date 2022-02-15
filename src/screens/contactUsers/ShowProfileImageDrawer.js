import React, { Component } from 'react'
import { View, TouchableHighlight } from 'react-native'

import { Avatar } from "react-native-elements"
import { connect } from 'react-redux'
import {DEFAULT_USER_ICON} from '../../constants/genericImages'


/* Esta vista sirve en realidad como componente para "ContactUsersRootComponent". Tuvimos que separar esta parte */ 
class ShowProfileImageDrawer extends Component {

	constructor(props) {
		super(props) 
	}

	render() {
		return (
			<View style = {{justifyContent: 'center', alignItems: 'center', paddingTop: 10, paddingBottom: 10}}>
				<TouchableHighlight
					onPress       = {() => this.props.navigateToUserProfile()}
					onLongPress   = {() => this.props.navigateToUserProfile()}
				>
					<View>
						<Avatar 
							source = {(this.props.profileImage != null) ? {uri: this.props.profileImage} : DEFAULT_USER_ICON}
							size   = 'xlarge'
						/>
					</View>
				</TouchableHighlight>
			</View>
		)
	}
}

/// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		user_id:      state.userReducer.user_id,
		profileImage: state.userReducer.profileImage, 
	}
};

export default connect(mapStateToProps)(ShowProfileImageDrawer)