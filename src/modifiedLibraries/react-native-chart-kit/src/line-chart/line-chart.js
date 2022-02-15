import React from "react";
import { View } from "react-native";
import {
	Svg,
	Circle,
	Polygon,
	Polyline,
	Path,
	Rect,
	G
} from "react-native-svg";
import AbstractChart from "../abstract-chart";
import { LegendItem } from "./legend-item";

class LineChart extends AbstractChart {
	getColor = (dataset, opacity) => {
		return (dataset.color || this.props.chartConfig.color)(opacity);
	};

	getStrokeWidth = dataset => {
		return dataset.strokeWidth || this.props.chartConfig.strokeWidth || 3;
	};

	getDatas = data => {
		return data.reduce((acc, item) => (item.data ? [...acc, ...item.data] : acc), []);
	}

	getPropsForDots = (x, i) => {
		const { getDotProps, chartConfig = {} } = this.props;
		if (typeof getDotProps === "function") {
			return getDotProps(x, i);
		}
		const { propsForDots = {} } = chartConfig;
		return { r: "4", ...propsForDots };
	};

	// Esta función fue modificada
	renderDots = config => {
		const {
			data,
			labels,
			scale,
			width,
			height,
			paddingTop,
			paddingRight,
			onDataPointClick,
			sizeOfUnit,
			minYValue,
			maxYValue,
			scaler,
		} = config;
		const output     = [];
		const datas      = this.getDatas(data);
		const baseHeight = this.calcBaseHeight(datas, height, minYValue, maxYValue, scaler);
		const minX       = labels[0];

		const {
			getDotColor,
			hidePointsAtIndex = [],
			renderDotContent  = () => {return null}
		} = this.props;
		data.forEach(dataset => {
			dataset.data.forEach((x, i) => {
				if (hidePointsAtIndex.includes(i)) {
					return;
				}
				const cx = Math.floor( paddingRight + Math.abs(labels[i] - minX) * sizeOfUnit / scale );
				const cy = ((baseHeight - this.calcHeight(x, datas, height, minYValue, maxYValue, scaler)) / 4) * 3 + paddingTop;
				const onPress = () => {
					if (!onDataPointClick || hidePointsAtIndex.includes(i)) {
						return;
					}
					onDataPointClick({
						index: i,
						value: x,
						dataset,
						x: cx,
						y: cy,
						getColor: opacity => this.getColor(dataset, opacity)
					});
				};
				output.push(
					<Circle
						key     = {Math.random()}
						cx      = {cx}
						cy      = {cy}
						fill    = { typeof getDotColor === "function" ? getDotColor(x, i) : this.getColor(dataset, 0.9) }
						onPress = {onPress}
						{...this.getPropsForDots(x, i)}
					/>,
					<Circle
						key         = {Math.random()}
						cx          = {cx}
						cy          = {cy}
						r           = "14"
						fill        = "#fff"
						fillOpacity = {0}
						onPress     = {onPress}
					/>,
					renderDotContent({ x: cx, y: cy, index: i })
				);
			});
		});
		return output;
	};

	renderShadow = config => {
		if (this.props.bezier) {
			return this.renderBezierShadow(config);
		}

		const { data, width, height, paddingRight, paddingTop, minYValue, maxYValue, scaler } = config;
		const datas = this.getDatas(data);
		const baseHeight = this.calcBaseHeight(datas, height, minYValue, maxYValue, scaler);
		return config.data.map((dataset, index) => {
			return (
				<Polygon
					key    = {index}
					points = {
						dataset.data.map((d, i) => {
							const x = paddingRight + (i * (width - paddingRight)) / dataset.data.length;
							const y = ((baseHeight - this.calcHeight(d, datas, height, minYValue, maxYValue, scaler)) / 4) * 3 + paddingTop;
							return `${x},${y}`;
						}).join(" ") + ` ${paddingRight + ((width - paddingRight) / dataset.data.length) * (dataset.data.length - 1)},${(height / 4) * 3 + paddingTop} ${paddingRight},${(height / 4) * 3 + paddingTop}`} /// `
					fill   = "url(#fillShadowGradient)"
					strokeWidth = {0} 
				/>
			);
		});
	};

	// Esta función fue modificada
	renderLine = config => {
		if (this.props.bezier) {
			return this.renderBezierLine(config);
		}

		const { width, height, paddingRight, paddingTop, data, scale, labels, sizeOfUnit, minYValue, maxYValue, scaler } = config;
		const output     = [];
		const datas      = this.getDatas(data);
		const baseHeight = this.calcBaseHeight(datas, height, minYValue, maxYValue, scaler);
		const minX       = labels[0];
		data.forEach((dataset, index) => {
			const points = dataset.data.map((d, i) => {
				const x = Math.floor( paddingRight + Math.abs(labels[i] - minX) * sizeOfUnit / scale );
				const y = ((baseHeight - this.calcHeight(d, datas, height, minYValue, maxYValue)) / 4) * 3 + paddingTop;
				return `${x},${y}`;
			});

			output.push(
				<Polyline
					key         = {index}
					points      = {points.join(" ")}
					fill        = "none"
					stroke      = {this.getColor(dataset, 0.5)}
					strokeWidth = {this.getStrokeWidth(dataset)}
				/>
			);
		});
		return output;
	};

	getBezierLinePoints = (dataset, config) => {
		const { width, height, paddingRight, paddingTop, data, scale, labels, sizeOfUnit, minYValue, maxYValue, scaler } = config;
		if (dataset.data.length === 0) {
			return "M0,0";
		}

		const minX = labels[0];
		const datas = this.getDatas(data);

		const x = i => {
			return Math.floor( paddingRight + Math.abs(labels[i] - minX) * sizeOfUnit / scale );
		}
		const baseHeight = this.calcBaseHeight(datas, height, minYValue, maxYValue, scaler);

		const y = i => {
	  		const yHeight = this.calcHeight(dataset.data[i], datas, height, minYValue, maxYValue, scaler);
	  		return Math.floor(((baseHeight - yHeight) / 4) * 3 + paddingTop);
		};

		return [`M${x(0)},${y(0)}`].concat( 
			dataset.data.slice(0, -1).map((_, i) => { // El slice(0,-1) elimina el último elemento
				const x_mid = (x(i) + x(i + 1)) / 2;
				const y_mid = (y(i) + y(i + 1)) / 2;
				const cp_x1 = (x_mid + x(i)) / 2;
				const cp_x2 = (x_mid + x(i + 1)) / 2;
				return (
					`Q ${cp_x1}, ${y(i)}, ${x_mid}, ${y_mid}` + ` Q ${cp_x2}, ${y(i + 1)}, ${x(i + 1)}, ${y(i + 1)}`
				);
			})
		).join(" ");
	};

	renderBezierLine = config => {
		return config.data.map((dataset, index) => {
			const result = this.getBezierLinePoints(dataset, config);
			return (
				<Path
					key         = {index}
					d           = {result}
					fill        = "none"
					stroke      = {this.getColor(dataset, 0.5)}
					strokeWidth = {this.getStrokeWidth(dataset)}
				/>
			);
		});
	};

	renderBezierShadow = config => {
		const { width, height, paddingRight, paddingTop, data } = config;
		return data.map((dataset, index) => {
			const d = this.getBezierLinePoints(dataset, config) + ` L${paddingRight + ((width - paddingRight) / dataset.data.length) * (dataset.data.length - 1)},${(height / 4) * 3 + paddingTop} L${paddingRight},${(height / 4) * 3 + paddingTop} Z`;
			return (
				<Path
					key         = {index}
					d           = {d}
					fill        = "url(#fillShadowGradient)"
					strokeWidth = {0}
				/>
			);
		});
	};

	renderLegend = (width, legendOffset) => {
		const { legend, datasets } = this.props.data;
		const baseLegendItemX = width / (legend.length + 1);

		return legend.map((legendItem, i) => (
			<G key = {Math.random()}>
				<LegendItem
					index           = {i}
					iconColor       = {this.getColor(datasets[i], 0.9)}
					baseLegendItemX = {baseLegendItemX}
					legendText      = {legendItem}
					labelProps      = {{ ...this.getPropsForLabels() }}
					legendOffset    = {legendOffset}
				/>
			</G>
		));
	};

	/// Este comentario es sólo para que el resto de la vista no se torne de un solo color
	render() {
		const {
			width,
			scale,
			minYValue,
			maxYValue,
			height,
			sizeOfUnit,
			data,
			withShadow           = true,
			withDots             = true,
			withInnerLines       = true,
			withOuterLines       = true,
			withHorizontalLabels = true,
			withVerticalLabels   = true,
			style = {},
			decorator,
			onDataPointClick,
			verticalLabelRotation   = 0,
			horizontalLabelRotation = 0,
			formatYLabel = yLabel => yLabel,
			formatXLabel = xLabel => xLabel,
			segments
		} = this.props;

		const { labels = [] } = data;

		const {
			borderRadius  = 0,
			paddingTop    = 16,
			paddingRight  = 64,
			margin        = 0,
			marginRight   = 0,
			paddingBottom = 0
		} = style;

		const datas = this.getDatas(data.datasets);


		const config = {
			width,
			scale,
			minYValue,
			maxYValue,
			height,
			verticalLabelRotation,
			horizontalLabelRotation,
			data,
			labels,
			sizeOfUnit,
			scaler: this.calcScaler(datas,minYValue,maxYValue),
		};

		let count;

		if (segments) {
			count = segments;
		}
		else if ((minYValue!=null) && (maxYValue!=null)){
			count = minYValue === maxYValue ? 1 : 4;
		}
		else {
			count = Math.min(...datas) === Math.max(...datas) ? 1 : 4;
		}

		const legendOffset = this.props.data.legend ? height * 0.15 : 0;

		return (
			<View style = {style}>
				<Svg
					height = {height + paddingBottom + legendOffset} 
					width  = {width - margin * 2 - marginRight}
				>
					<Rect
						width  = "100%"
						height = {height + legendOffset}
						rx     = {borderRadius}
						ry     = {borderRadius}
						fill   = "url(#backgroundGradient)"
					/>
					{this.props.data.legend &&
						this.renderLegend(config.width, legendOffset)
					}
					<G x="0" y={legendOffset}>
						{this.renderDefs({
							...config,
							...this.props.chartConfig
						})}
						<G>
							{withInnerLines
								? this.renderHorizontalLines({
									...config,
									count: count,
									paddingTop,
									paddingRight
								})
								: withOuterLines
								? this.renderHorizontalLine({
									...config,
									paddingTop,
									paddingRight
								})
								: null
							}
						</G>
						<G>
							{withHorizontalLabels
								? this.renderHorizontalLabels({
									...config,
									count: count,
									data:  datas,
									paddingTop,
									paddingRight,
									formatYLabel,
									decimalPlaces: this.props.chartConfig.decimalPlaces
								})
								: null
							}
						</G>
						<G>
							{withInnerLines
								? this.renderVerticalLines({
									...config,
									data: data.datasets[0].data,
									paddingTop,
									paddingRight
								})
								: withOuterLines
								? this.renderVerticalLine({
									...config,
									paddingTop,
									paddingRight
								})
								: null
							}
						</G>
						<G>
							{withVerticalLabels
								? this.renderVerticalLabels({
									...config,
									labels,
									paddingRight,
									paddingTop,
									formatXLabel
								})
								: null
							}
						</G>
						<G>
							{this.renderLine({
								...config,
								paddingRight,
								paddingTop,
								data: data.datasets
							})}
						</G>
						<G>
						{withShadow &&
							this.renderShadow({
								...config,
								data: data.datasets,
								paddingRight,
								paddingTop
							})
						}
						</G>
						<G>
							{withDots &&
								this.renderDots({
									...config,
									data: data.datasets,
									paddingTop,
									paddingRight,
									onDataPointClick
								})
							}
						</G>
						<G>
							{decorator &&
								decorator({
									...config,
									data: data.datasets,
									paddingTop,
									paddingRight
								})
							}
						</G>
					</G>
				</Svg>
			</View>
		);
	}
}

export default LineChart;
