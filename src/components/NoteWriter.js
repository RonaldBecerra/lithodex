import React from 'react';
import { Text, Button, TextInput, View,
		TouchableHighlight, StyleSheet, Modal } from 'react-native';

import { connect } from 'react-redux'

import * as Database from '../genericFunctions/databaseFunctions'


class NoteWriter extends React.Component {
	constructor(props){
		super(props)
		this.state = {
			writtenText: (this.props.data.writtenText == null) ? null : this.props.data.writtenText,
			componentKey: this.props.stratum_key + '_note', // Para que se sepa qué parte del estrato se va a salvar

			// Esta variable no se refiere a la altura de la vista, sino a la altura que ocupan las líneas de texto       
			heightLines: (this.props.data.heightLines == null) ? 0 : this.props.data.heightLines,
		}
	}

	// Usado para cambiar el texto almacenado
	acceptText (newText) {
		this.setState({writtenText: newText});
		var payload = {
			writtenText: newText,
			heightLines: this.state.heightLines,
		}
		Database.saveStratumModule(this.props.user_id, this.props.Object_id, this.props.index, this.state.componentKey, payload, this.props.isCore, this.props.localDB);
  	}

  	// Lo que se le mostrará al usuario
	render() {
		let p = this.props;

		// No queremos que se muestre texto al hacer una captura si éste no va a salir completo
		if (p.takingShot && (this.state.heightLines > p.height+6)){
			return (
				<View style = {{borderColor: 'black', borderWidth: 1, height: p.height, width: p.width}}/>
			)
		}

		return (
			<View>
				{(this.props.height) >= 18 &&
					<TextInput
						style = {{ 
							height:         p.height, 
							width:          p.width, 
							borderColor:    'black', 
							borderWidth:    1, 
							padding:        5,
							textAlign:      'center',
						}}
						onChangeText        = {text => this.acceptText(text)}
						multiline           = {true}
						selectTextOnFocus   = {false}
						defaultValue        = {this.state.writtenText}
						onContentSizeChange = {(event) => {
							this.setState({heightLines: event.nativeEvent.contentSize.height})
						}}
					/>
				}

				{(this.props.height) < 18 &&
					<View style = {{borderColor: 'black', borderWidth: 1, height: p.height, width: p.width}}/>
				}
			</View>
		);
	}
}

/// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		user_id: state.userReducer.user_id,
		localDB: state.userReducer.localDB,
	}
};

export default connect(mapStateToProps)(NoteWriter);
