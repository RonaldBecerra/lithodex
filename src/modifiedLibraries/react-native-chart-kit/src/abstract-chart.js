import React, { Component } from "react";

import { LinearGradient, Line, Text, Defs, Stop } from "react-native-svg";

class AbstractChart extends Component {

	// Función que retorna la diferencia entre el mayor y el menor valor de los datasets leídos,
	// y con la modificación hecha, ahora puede calcular la diferencia entre un mayor y menor suministrados.
	// Siempre devuelve 1 si el resultado es 0
	calcScaler = (data, minYValue=null, maxYValue=null) => {
		if (this.props.fromZero) {
			const min = (minYValue != null) ? Math.min(minYValue,0) : Math.min(...data, 0);
			const max = (maxYValue != null) ? Math.max(maxYValue,0) : Math.max(...data, 0);

			return (max - min) || 1;
		} else {
			const min = (minYValue != null) ? minYValue : Math.min(...data);
			const max = (maxYValue != null) ? maxYValue : Math.max(...data);

			return (max - min) || 1;
		}
	};

	// Él toma como altura base, es decir, desde la que empieza a contar, a la altura de más arriba de la gráfica, que llamaremos altura máxima
	// Luego los demás puntos de la gráfica inferiores estarán ubicados a esa altura máxima, menos cierta cantidad.
	calcBaseHeight = (data, height, minYValue=null, maxYValue=null, scaler=null) => {
		// console.log("\nEn calcBaseHeight:");
		// console.log("minYValue = ", minYValue);
		// console.log("maxYValue = ", maxYValue);
		// console.log("scaler = ", scaler);

		const min = (minYValue != null) ? minYValue : Math.min(...data);
		const max = (maxYValue != null) ? maxYValue : Math.max(...data);
		scaler = (scaler!=null) ? scaler : this.calcScaler(data, min, max);

		// console.log("\nEn calcBaseHeight:");
		// console.log("min = ", min);
		// console.log("max = ", max);
		// console.log("scaler = ", scaler);

		if (min >= 0 && max >= 0) {
			// Si ambos valores son no negativos, la altura máxima es igual a la altura que fue suministrada
			return height;
		} else if (min < 0 && max <= 0) {
			// Si ambos valores son negativos o cero, la altura máxima será cero
			return 0;
		} else if (min < 0 && max > 0) {
			// Si el mínimo es negativo y el máximo es positivo, la fórmula que sigue es equivalente a como si empezaras teniendo la gráfica con el 
			// mínimo en cero, y luego la bajaras hasta que el mínimo esté en su lugar correspondiente. Eso también hace que la altura máxima se baje,
			// es decir, ya no será igual a la altura suministrada.
			return (height * max) / scaler;
		}
	};

	// Calcula la altura a la que debe aparecer el valor "val"
	calcHeight = (val, data, height, minYValue=null, maxYValue=null, scaler=null) => {
		// console.log("\nEn calcHeight:");
		// console.log("minYValue = ", minYValue);
		// console.log("maxYValue = ", maxYValue);
		// console.log("scaler = ", scaler);

		const min = (minYValue != null) ? minYValue : Math.min(...data);
		const max = (maxYValue != null) ? maxYValue : Math.max(...data);
		scaler = (scaler!=null) ? scaler : this.calcScaler(data, min, max);

		if (min < 0 && max > 0) {
			return height * (val / scaler);
		} else if (min >= 0 && max >= 0) {
			return this.props.fromZero
				? height * (val / scaler)
				: height * ((val - min) / scaler);
		} else if (min < 0 && max <= 0) {
			return this.props.fromZero
				? height * (val / scaler)
				: height * ((val - max) / scaler);
		}
	};

	getPropsForBackgroundLines() {
		const { propsForBackgroundLines = {} } = this.props.chartConfig;
		return {
			stroke: this.props.chartConfig.labelColor(0.2),
			strokeDasharray: "5, 10",
			strokeWidth: 1,
			...propsForBackgroundLines
		};
	}

	getPropsForLabels() {
		const {
			propsForLabels = {},
			color,
			labelColor = color
		} = this.props.chartConfig;

		return {
			fontSize: 12,
			fill: labelColor(0.8),
			...propsForLabels
		};
	}

	// Aquí se hizo una modificación
	renderHorizontalLines = config => {
		const { count, width, height, paddingTop, paddingRight, data } = config;
		const basePosition = height - height / 4; // No sé por qué considera así la posición base
		const div = (basePosition / count);

		// Esto para que no quede un espacio sobrante en las líneas mostradas
		const widthForLines = width - (width - paddingRight) / data.datasets[0].data.length;

		return [...new Array(count+1)].map((_, i) => { // El +1 es para que también coloque la línea que corresponde al primer elemento
			const y = div * i  + paddingTop;
			return (
				<Line
					key = {Math.random()}
					x1  = {paddingRight}
					y1  = {y}
					x2  = {widthForLines} // Originalmente esto era "width"
					y2  = {y}
					{...this.getPropsForBackgroundLines()}
				/>
			);
		});
	};

	// Esto no se ha modificado porque no se necesita. Se utiliza cuando la gráfica tiene una leyenda. Pero de todos modos habría que cambiarlo si se llegara a usar
	renderHorizontalLine = config => {
		const { width, height, paddingTop, paddingRight } = config;
		return (
			<Line
				key = {Math.random()}
				x1  = {paddingRight}
				y1  = {height - height / 4 + paddingTop}
				x2  = {width}
				y2  = {height - height / 4 + paddingTop}
				{...this.getPropsForBackgroundLines()}
			/>
		);
	};

	// Esto ya no se utiliza aquí, sino que copiamos su definición en el archivo que lo emplea, para que el ScrollView no mueva estas etiquetas también
	renderHorizontalLabels = config => {
		const {
			count,
			data,
			scaler,
			minYValue,
			height,
			paddingTop,
			paddingRight,
			horizontalLabelRotation = 0,
			decimalPlaces = 2,
			formatYLabel = yLabel => yLabel
		} = config;

		const {
			yAxisLabel = "",
			yAxisSuffix = "",
			yLabelsOffset = 12
		} = this.props;

		const basePosition = height - height / 4;
		const x = paddingRight - yLabelsOffset;
		return [...Array(count === 1 ? 1 : count + 1).keys()].map((i, _) => {
			let yLabel = i * count;

			if (count === 1) {
				yLabel = `${yAxisLabel}${formatYLabel(
					data[0].toFixed(decimalPlaces)
				)}${yAxisSuffix}`;
			} else {
				const label = this.props.fromZero
					? (scaler / count) * i + Math.min(minYValue, 0)
					: (scaler / count) * i + minYValue;
				yLabel = `${yAxisLabel}${formatYLabel(
					label.toFixed(decimalPlaces)
				)}${yAxisSuffix}`;
			}

			const y =
				count === 1 && this.props.fromZero
					? paddingTop + 4
					: (height * 3) / 4 - (basePosition / count) * i + paddingTop;

			return (
				<Text
					rotation   = {horizontalLabelRotation}
					origin     = {`${x}, ${y}`}
					key        = {Math.random()} 
					x          = {x}
					textAnchor = "end"
					y          = {y}
					{...this.getPropsForLabels()}
				>
					{yLabel}
				</Text>
			);
		});
	};

	//`///Holllo  ksksks
	renderVerticalLabels = config => {
		const {
			labels = [],
			scale,
			sizeOfUnit,
			width,
			height,
			paddingRight,
			paddingTop,
			horizontalOffset = 0,
			stackedBar = false,
			verticalLabelRotation = 0,
			formatXLabel = xLabel => xLabel
		} = config;
		const {
			xAxisLabel = "",
			xLabelsOffset = 0,
			hidePointsAtIndex = []
		} = this.props;
		const fontSize = 12;
		let fac = 1;
		if (stackedBar) {
			fac = 0.71;
		}

		const minX        = labels[0];
		const lenMinusOne = labels.length - 1;

		return labels.map((label, i) => {
			if (hidePointsAtIndex.includes(i)) {
				return null;
			}
			const x = 10 + Math.floor( paddingRight + Math.abs(labels[i] - minX) * sizeOfUnit / scale ) * fac;

			const y = (height * 3) / 4 + paddingTop + fontSize * 2 + xLabelsOffset;
			return (
				<Text
					origin   = {`${x}, ${y}`} 
					rotation = {verticalLabelRotation}
					key      = {Math.random()}
					x        = {x}
					y        = {y}
					textAnchor={verticalLabelRotation === 0 ? "middle" : "start"}
					{...this.getPropsForLabels()}
				>
					{`${formatXLabel(label)}${xAxisLabel}`} 
				</Text>
			);
		});
	};


	// `//Esta función fue modificada
	renderVerticalLines = config => {
		const { data, width, height, paddingTop, paddingRight, scale, labels, sizeOfUnit } = config;

		const minX = labels[0];

		return [...new Array(data.length)].map((_, i) => {
			const x = Math.floor( paddingRight + Math.abs(labels[i] - minX) * sizeOfUnit / scale );
			return (
				<Line
					key = {Math.random()}
					x1  = {x}
					y1  = {paddingTop}
					x2  = {x}
					y2  = {height - height / 4 + paddingTop}
					{...this.getPropsForBackgroundLines()}
				/>
			);
		});
	};

	// Esto no se ha modificado porque no se necesita. Se utiliza cuando la gráfica tiene una leyenda. Pero de todos modos habría que cambiarlo si se llegara a usar
	renderVerticalLine = config => {
		const { height, paddingTop, paddingRight } = config;
		return (
			<Line
				key = {Math.random()}
				x1  = {Math.floor(paddingRight)}
				y1  = {0}
				x2  = {Math.floor(paddingRight)}
				y2  = {height - height / 4 + paddingTop}
				{...this.getPropsForBackgroundLines()}
			/>
		);
	};

	renderDefs = config => {
		const {
			width,
			height,
			backgroundGradientFrom,
			backgroundGradientTo
		} = config;
		const fromOpacity = config.hasOwnProperty("backgroundGradientFromOpacity")
			? config.backgroundGradientFromOpacity
			: 1.0;
		const toOpacity = config.hasOwnProperty("backgroundGradientToOpacity")
			? config.backgroundGradientToOpacity
			: 1.0;

		const fillShadowGradient = config.hasOwnProperty("fillShadowGradient")
			? config.fillShadowGradient
			: this.props.chartConfig.color();

		const fillShadowGradientOpacity = config.hasOwnProperty(
			"fillShadowGradientOpacity"
		)
			? config.fillShadowGradientOpacity
			: 0.1;

		return (
			<Defs>
				<LinearGradient
					id = "backgroundGradient"
					x1 = "0"
					y1 = {height}
					x2 = {width} 
					y2 = {0}
				>
					<Stop
						offset      = "0"
						stopColor   = {backgroundGradientFrom}
						stopOpacity = {fromOpacity}
					/>
					<Stop
						offset      = "1"
						stopColor   = {backgroundGradientTo}
						stopOpacity = {toOpacity}
					/>
				</LinearGradient>
				<LinearGradient
					id = "fillShadowGradient"
					x1 = {0}
					y1 = {0}
					x2 = {0}
					y2 = {height}
				>
					<Stop
						offset      = "0"
						stopColor   = {fillShadowGradient}
						stopOpacity = {fillShadowGradientOpacity}
					/>
					<Stop offset="1" stopColor={fillShadowGradient} stopOpacity="0" />
				</LinearGradient>
			</Defs>
		);
	};
}

export default AbstractChart;
