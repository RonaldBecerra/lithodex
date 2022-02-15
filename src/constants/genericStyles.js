import { StyleSheet, Dimensions } from 'react-native'
import * as D from './Dimensions'

export const LIGHTGRAY_COLOR = '#f5f5f5';
export const DARK_GRAY_COLOR = '#4f4f4f';
export const WHITE_COLOR     = '#ffffff';
export const ORANGE_COLOR    = '#ed6609';

// Aquí colocaremos los diversos estilos que se repiten en varias vistas, y que no queremos redefinirlos en cada una
export const genericStyles = StyleSheet.create({

	// Usado para cualquier elemento que queramos tener centrado en su espacio asignado
	simple_center: {
		flex:           1,
 		justifyContent: 'center',
		alignItems:     'center', 
	},

	// Usado para reservar un espacio para los botones que suelen aparecer en la parte inferior
	down_buttons: {
		flex:           0.12, 
		padding:        5,  
 		justifyContent: 'space-around',
		alignItems:     'center', 
		flexDirection:  'row',
	},

	/* Crea un fondo gris claro, que permite que el sector donde están los botones de la parte inferior
	   como casi siempre sucede con los de "Aceptar" y "Cancelar", se diferencie del resto del contenido */
	lightGray_background: { 
		flex:            1, 
		alignItems:      'center', 
		justifyContent:  'flex-start', 
		backgroundColor: LIGHTGRAY_COLOR,
	},

	/* Crea un fondo blanco. Se usa para cubrir al fondo gris "lightGray_background", pero no lo cubre todo.
	   Siempre queda un espacio en el que se ve el fondo gris. Se usa cuando la vista correspondiente incluye
	   un ScrollView*/
	white_background_with_ScrollView: {
		flex:            0.88,
		flexDirection:   'row', 
	    padding:         10, 
		backgroundColor: WHITE_COLOR,
	},

	/* Crea un fondo blanco. Se usa para cubrir al fondo gris definido justo arriba, pero no lo cubre todo.
	   Siempre queda un espacio en el que se ve el fondo gris. Se usa cuando la vista correspondiente NO incluye
	   un ScrollView*/
	white_background_without_ScrollView: {
		flex:            0.88,
		flexDirection:   'column', 
		backgroundColor: WHITE_COLOR,
		width:           D.GLOBAL_SCREEN_WIDTH,
	},

	// Usado en los formularios para colocar en una fila las instrucciones y el cuadro de un campo a rellenar
	row_instructions_textInput: {
		flex:           1,
		flexDirection:  'row',
		justifyContent: 'center',
		alignItems:     'center',
		padding:        10,
		paddingTop:     10,
		paddingBottom:  10,
	},

	/* Usado en los formularios largos para establecer las dimensiones del cuadro de texto en el que el
	   usuario añade algún tipo de información */
	textInput: {
		height:      35,
		borderWidth: 1,
		flex:        1,
		padding:     5, // Esto es lo que hace que el texto no salga pegado al borde
		borderColor: 'black',
	},

	/* Usado cuando tenemos uno o más campos a rellenar, cuyas instrucciones aparecen encima de los cuadros de texto,
	   no a la izquierda de los mismos. Un ejemplo es cuando usamos dos campos, porque uno es para metros y el otro
	   es para pies */
	instructionsAboveTextInputs: {
		flexDirection:  'column',
		justifyContent: 'center',
		alignItems:     'center',
		padding:        10,
		paddingTop:     10,
		paddingBottom:  10,
	},

	/* Usado cuando en la parte inferior de una vista se quiere mostrar el valor de un campo, como cuando
	   en el formulario de núcleos se muestra el valor de R, o cuando en la vista de fósiles se muestra el 
	   fósil seleccionado, entre otros casos */
	smallRow: {
		flex:           0.05,
		flexDirection:  'row',
		justifyContent: 'space-around',
		alignItems:     'center',
		padding:        10,
	},

	/* Sirve para mostrar un título de cabecera en un modal, ya que allí se ocultó la cabecera del navegador de pila.
	   Por ejemplo, con esto se muestra el nombre del estrato que se está modificando cuando se ingresa en uno de los módulos
	   de estrato, como Litología, Estructura, Fósiles, etc. */
	modalHeader: {
		flex:            0.1,
		flexDirection:   'row',
		justifyContent:  'center',
		alignItems:      'center',
		paddingTop:      15,
		paddingBottom:   15,
		width:           D.GLOBAL_SCREEN_WIDTH,
	},

	// Para mostrar texto centrado, que aparece en negritas y con letras algo más grandes que el resto
	subtitle: {
		flex:           1, 
		flexDirection:  'row',
		paddingTop:     10, 
		paddingBottom:  10,
		textAlign:      'center',
		fontWeight:     'bold', 
		fontSize:       15,
	},

    // Formato de la cabecera de cada vista de navegación
    navigationHeader: {
        height: (D.WIDTH_IS_MIN) ? (5/31) * D.GLOBAL_SCREEN_WIDTH : (2/21) * D.GLOBAL_SCREEN_HEIGHT,
    },

});