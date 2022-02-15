import React from 'react';
import { Text, View, StyleSheet } from 'react-native'

import { connect } from 'react-redux'
import { genericStyles, WHITE_COLOR } from '../constants/genericStyles'
import * as D            from '../constants/Dimensions'

import {LineChart} from '../modifiedLibraries/react-native-chart-kit';


class GammaRayPlot extends React.Component {

	constructor(props){
		super(props)
	}

	// Función que dibuja la gráfica
	plotFunction(xValues, yValues, plotHeight, scale, minDifference, minYValue, maxYValue){
		let p = this.props;
		var withVerticalLabels = true; // Determina si se muestran las etiquetas que representan las profundidades

		// Si los números en el eje vertical van a salir muy pequeños, no colocamos ninguno. 
		if (minDifference * 65 / scale < 13){
			withVerticalLabels = false;
		}

		return (
			<View style = {localStyles.container}>
				<LineChart
					data = {{
						labels:   xValues,
						datasets: [{ data: yValues}],
					}}

					width  = {plotHeight} // Como rotamos la vista 90 grados, lo que aquí se considera la anchura en realidad será la altura
					height = {D.GAMMA_RAY_WIDTH + 40}

					// Es raro que aquí él sí sepa que las etiquetas verticales son las del eje x, a pesar de que la vista está rotada
					verticalLabelRotation = {-90} 

					// Como las etiquetas horizontales (que en realidad son las verticales) las estamos creando aquí, entonces ya en la libería no las tenemos que colocar
					withHorizontalLabels = {false} 

					// Dependerá de lo juntos que estén los datos si se muestran o no las etiquetas de profundidad
					withVerticalLabels = {withVerticalLabels}

					withDots   = {false} // Para que no se coloque un punto en cada dato leído
					withShadow = {false} // Para que no se vea la gráfica rellena a la izquierda de la curva (originalmente debajo de la curva)
					segments   = {p.numberVSegments} // Número de líneas (verticales en este caso, aunque originalmente son las horizontales) segmenteadas que se mostrarán
					
					xLabelsOffset = {20} // Para que las etiquetas (verticales en nuestro caso) no salgan tan pegadas a la gráfica
					xAxisLabel    = {(p.unit == 0) ? "m" : "ft"} // Para que salgan las unidades de medición

					// Parámetros que se le agregaron a la librería
					scale      = {scale} // Necesitamos pasar la información de cuál es la escala que estamos utilizando
					sizeOfUnit = {D.SIZE_OF_UNIT} // También necesitamos saber el tamaño de cada unidad de escala
					maxYValue  = {maxYValue} // Máximo valor Y (gamma-ray)
					minYValue  = {minYValue} // Mínimo valor Y (gamma-ray)

					chartConfig = {{
						backgroundColor:        WHITE_COLOR,
						backgroundGradientFrom: WHITE_COLOR, 
						backgroundGradientTo:   WHITE_COLOR,
						decimalPlaces: 2, // Esto es opcional, porque por defecto se coloca en 2
						color:      (opacity = 100) => `rgba(207, 0, 15, ${opacity})`, // Color de la gráfica
						labelColor: (opacity = 255) => `rgba(0, 0, 0, ${opacity})`, // Color de los números y de las líneas segmenteadas internas
						style: { borderRadius: 1},
					}}
					bezier
					style = {{marginVertical: 0, borderRadius: 1, paddingRight: 0, paddingTop: 5}} 
				/>
			</View>
		);
	}

	/// Lo que se le mostrará al usuario
	render() {
		let s = this.state;
		let p = this.props;

		let buildingPlot = true; // Este booleano determina si todavía se están creando los arreglos, de modo de todavía no mostrar la gráfica en caso afirmativo.

		var gammaRayValues = (p.gammaRayValues.hasOwnProperty('xValuesMeters')) ? p.gammaRayValues : 
			((this.props.gammaRayValues_Extract.hasOwnProperty('xValuesMeters')) ? this.props.gammaRayValues_Extract : null);

		if (gammaRayValues != null){
			var numElements   = gammaRayValues.xValuesMeters.length;
			var xValues       = (p.unit == 0) ? gammaRayValues.xValuesMeters : gammaRayValues.xValuesFeet;
			var yValues       = gammaRayValues.yValues;
			var minDifference = gammaRayValues.minDifference[p.unit];
			var minYValue     = gammaRayValues.minYValue;
			var maxYValue     = gammaRayValues.maxYValue;

			/* El multiplicar por "numElements" y dividir por numElements -1 se debe a que la librería siempre 
			   considera un espacio adicional después de que ha terminado de plotear todos los datos

			   Según las pruebas que se han hecho, la máxima altura que puede tener la gráfica antes de que empiecen
			   a ocurrir errores es 2730
			 */
			var plotHeight = (xValues[0] - xValues[numElements-1]) * D.SIZE_OF_UNIT * numElements / (p.scale[0] * (numElements - 1));
			buildingPlot = false;
		}

		if (buildingPlot || xValues.length == 0){
			// Esto se ve tanto cuando se está construyendo la gráfica, como cuando no hay datos para hacer la gráfica 
			// y entonces no mostramos nada
			return (
				<View style = {{width: D.GAMMA_RAY_WIDTH}}/>
			)
		}
		// Altura que tendrá el espacio sobrante superior, el cual se debe a que el núcleo podría empezar antes que los datos de gamma-ray
		let dif = p.topHeightCore - xValues[0];
		let superiorHeight = (dif > 0) ? (dif * D.SIZE_OF_UNIT / p.scale[0]) : 0;

		// Indica que el espacio entre la cabecera (lo que serían las etiquetas superiores) y donde comienza la gráfica es mayor que 40
		const moreThanForty = (superiorHeight > 40); 

		if (p.takingShot && moreThanForty){
			// Restamos 40 porque en la vista externa ya no se muestran las etiquetas superiores con valores de gamma-ray.
			// En la vista externa, les habíamos asignado una altura de 37 a dichas eqtiquetas, pero por alguna razón
			// aquí hubo que colocar 40 para que cuadraran las mediciones
			superiorHeight -= 40;
		}

		return (
			<View style = {{width: D.GAMMA_RAY_WIDTH, flexDirection: 'column'}}>
				{p.takingShot && moreThanForty &&
					<View style = {{paddingTop: superiorHeight, paddingLeft: D.GAMMA_RAY_WIDTH - (3*(D.GAMMA_RAY_WIDTH+40)/4 + 16)}}>
						{p.superiorLabels}
					</View>
				}
				{((!p.takingShot) || (!moreThanForty)) &&
					<View style = {{height: superiorHeight}}/>
				}
				{this.plotFunction(xValues, yValues, plotHeight, p.scale[0], minDifference, minYValue, maxYValue)}
			</View>
		);
	}
}

/// Constante para darle formato a los diversos componentes de esta pantalla
const localStyles = StyleSheet.create({

	container: {
		justifyContent: 'center', 
		alignItems:     'flex-start', 
		transform:      [{ rotate: "90deg" }],
		height:         D.GAMMA_RAY_WIDTH, // Como la vista está rotada, esto en realidad es una anchura
		paddingTop:     20,
	},
});

// Función para obtener las variables deseadas desde el estado global de la tienda Redux
const mapStateToProps = (state) => {
	return {
		gammaRayValues_Extract: state.popUpReducer.gammaRayValues_Extract,
	}
};

export default connect(mapStateToProps)(GammaRayPlot);
