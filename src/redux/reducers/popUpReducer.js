/* Aquí están los reductores que mantendrán control sobre el flujo de las vistas de la aplicación,
   como determinar si una vista debe recargar datos desde la base de datos o no */

import { CHANGE_LOAD_VIEW, CHANGE_GAMMA_RAY_EXTRACT, CHANGE_STRATUM_COMPONENT_PERMISSION,
		  CHANGE_STACK_SCREENPROPS_FUNCTION, CHANGE_HEADER_TITLE} from '../reduxTypes'

const initialState = {
	loadView: false,
	gammaRayValues_Extract: {},
	stratumComponentEnabled: true,

	// Las funciones que guardemos las colocaremos dentro de la propiedad "ref" de un objeto, porque si hacemos que esta variable almacene directamente la referencia
	// de la función, Redux lo interpreta como que constantemente se esta actualizando el estado, y eso no lo deseamos.
	stackScreenPropsFunction: {ref: () => {}}, 

	// Esto sirve para darle un título a una vista en la cabecera cuando no estamos ubicados en una vista del navegador de pila
	// y, por lo tanto, no podemos establecr un título de la forma convencional. Por ejemplo, esto sucede cuando estamos en las
	// vistas del Drawer Navigator
	headerTitle: null,
};

const popUpReducer = (state = initialState, action) => {
	switch (action.type){

		// Caso en que debe cambiarse el booleano que indica si una vista debe volver a cargar datos o no
		case CHANGE_LOAD_VIEW:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				loadView: action.payload,
			}

		// Caso en que debe cambiarse el extracto de valores de la gráfica de gamma-ray que se está mostrando en un momento dado
		case CHANGE_GAMMA_RAY_EXTRACT:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				gammaRayValues_Extract: action.payload,
			}

		// Caso en que debe cambiarse la variable booleana que permite o impide el acceso a un componente de un estrato (Litología, Estructura sedimentaria, ...)
		case CHANGE_STRATUM_COMPONENT_PERMISSION:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				stratumComponentEnabled: action.payload,
			}

		// Caso en que debe cambiarse la función que está almacenada en el ScreenProps del StackNavigator de la aplicación
		case CHANGE_STACK_SCREENPROPS_FUNCTION:
			const newState = {...state}; // Mantenemos igual el resto de la información del estado
			newState.stackScreenPropsFunction.ref = action.payload;
			return newState;

		// Caso en que debe cambiarse el título que aparece la cabecera de una vista
		case CHANGE_HEADER_TITLE:
			return {
				...state, // Mantenemos igual el resto de la información del estado
				headerTitle: action.payload,
			}

		// Caso por defecto, que se utiliza si el tipo de la acción no coincide con ninguno de los establecidos aquí
		default:
			return state;
	}
}

export default popUpReducer;