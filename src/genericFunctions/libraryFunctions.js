import React, { Component } from 'react';
import {Text, View} from 'react-native'

import { LITHOLOGIES_IMAGES, LITHOLOGIES_NAMES } from '../constants/lithologies'
import { STRUCTURES_NAMES, STRUCTURES_IMAGES }   from '../constants/structures'
import { FOSSILS_NAMES, FOSSILS_IMAGES }         from '../constants/fossils'

import { CARBONATES_GRAIN_DIAMETERS, NO_CARBONATES_GRAIN_DIAMETERS } from '../constants/grains'
import * as D from '../constants/Dimensions'


/* Aquí creamos una lista de litologías cuyos elementos tengan los campos: "key", "uri" y "name", donde 
   "name" depende del idioma actual, y por ello es que tenemos que construir esta lista.
*/
export function createSortedListOfLithologies(language){
	// Aquí almacenamos los nombres de las litologías que se le mostrarán al usuario, de acuerdo al idioma
	var AllLithologiesNames    = LITHOLOGIES_NAMES[language];
	var totalListOfLithologies = [];

	for (var i = 0; i < LITHOLOGIES_IMAGES.length; i++){
		var patternToAdd = LITHOLOGIES_IMAGES[i];
		var newElement   = {key: patternToAdd.key, uri: patternToAdd.uri, name: AllLithologiesNames[i].name};
		totalListOfLithologies.push(newElement);				
	}
	return totalListOfLithologies.sort((a, b) => (a.name > b.name) ? 1 : -1);
}

/* Aquí creamos una lista de estructuras cuyos elementos tengan los campos: "key", "uri" y "name", donde 
   "name" depende del idioma actual, y por ello es que tenemos que construir esta lista.
*/
export function createSortedListOfStructures(language){
	// Aquí almacenamos los nombres de las estructuras que se le mostrarán al usuario, de acuerdo al idioma
	var AllStructuresNames    = STRUCTURES_NAMES[language];
	var totalListOfStructures = [];

	for (var i = 0; i < STRUCTURES_IMAGES.length; i++){
		var structureToAdd = STRUCTURES_IMAGES[i];
		var newElement     = {key: structureToAdd.key, uri: structureToAdd.uri, name: AllStructuresNames[i].name};
		totalListOfStructures.push(newElement);				
	}
	return totalListOfStructures.sort((a, b) => (a.name > b.name) ? 1 : -1);
}

/* Aquí creamos una lista de fósiles cuyos elementos tengan los campos: "key", "uri", y "name", donde 
   "name" depende del idioma actual, y por ello es que tenemos que construir esta lista.
*/
export function createSortedListOfFossils(language){
	// Aquí almacenamos los nombres de los fósiles que se le mostrarán al usuario, de acuerdo al idioma
	var AllFossilNames     = FOSSILS_NAMES[language];
	var totalListOfFossils = [];

	for (i = 0; i < FOSSILS_IMAGES.length; i++){
		var fossilToAdd = FOSSILS_IMAGES[i];
		var newElement  = {key: fossilToAdd.key, uri: fossilToAdd.uri, name: AllFossilNames[i].name};
		totalListOfFossils.push(newElement);				
	}
	return totalListOfFossils.sort((a, b) => (a.name > b.name) ? 1 : -1);
}

// Auxiliar para crear textos de una regla horizontal
function createHorizontalRule_Texts(language, noCarbonates){
	// Caso en que el texto aparece superior a las líneas de la regla (no carbonatos)
	if (noCarbonates){
		let array = NO_CARBONATES_GRAIN_DIAMETERS[language];
		return (
			<View style = {{flexDirection: 'column', paddingBottom: 3}}>
				<View style = {{flexDirection: 'row'}}>
					{array.map((item,i) => (
						<View style={{flexDirection: 'column'}}  key={i}>
							{/*Texto de la regla*/}
							<View style = {{width: D.LITHOLOGY_ADDING_TERM, paddingBottom: 2, flexDirection: 'row', justifyContent: 'flex-start'}}>
								<Text style = {{fontSize: 10}}>{item}</Text>
							</View>
						</View>
					))}
				</View>
			</View>
		)
	}
	/// Caso en que el texto aparece inferior a las líneas de la regla (carbonatos)
	let array = CARBONATES_GRAIN_DIAMETERS[language];
	return(
		<View style = {{flexDirection: 'column', paddingtop: 10}}>
			<View style = {{flexDirection: 'row'}}>
				{array.map((item,i) => (
					<View style={{flexDirection: 'column'}}  key={i}>
						{/*Texto de la regla*/}
						<View style = {{width: D.LITHOLOGY_ADDING_TERM, paddingBottom: 2, flexDirection: 'row', justifyContent: 'flex-start'}}>
							<Text style = {{fontSize: 10}}>{item}</Text>
						</View>
					</View>
				))}
			</View>
		</View>	
	)
}

/// Auxiliar para crear las líneas de una regla horizontal
function createHorizontalRule_Lines(language, noCarbonates){
	// Caso en que la línea horizontal de la regla debe aparecer debajo de las verticales (no carbonatos)
	if (noCarbonates){
		let array = NO_CARBONATES_GRAIN_DIAMETERS[language];
		return (
			<View style = {{flexDirection: 'column', paddingBottom: 5}}>
				<View style = {{flexDirection: 'row'}}>
					{array.map((item,i) => (
						<View style={{flexDirection: 'column'}}  key={i}>
							{/*Línea vertical divisoria de la regla*/}
							<View style = {{height: 8, borderLeftColor: 'black', borderLeftWidth: 1, flexDirection: 'column', width: D.LITHOLOGY_ADDING_TERM}}/>
						</View>
					))}
				</View>
				{/*Línea horizontal de la regla */}
				<View style = {{width: D.LITHOLOGY_PICKER_WIDTH - 50 + 1.5, flexDirection: 'row', borderWidth: 0.7, borderColor: 'black'}}/>
			</View>	
		)
	}
	/// Caso en que la línea horizontal de la regla debe aparecer encima de las verticales (carbonatos)
	let array = CARBONATES_GRAIN_DIAMETERS[language];
	return(
		<View style = {{flexDirection: 'column', paddingTop: 5}}>
			{/*Línea horizontal de la regla */}
			<View style = {{width: D.LITHOLOGY_PICKER_WIDTH - 110 + 1, flexDirection: 'row', borderWidth: 0.7, borderColor: 'black'}}/>

			{/*Líneas verticales divisorias de la regla*/}
			<View style = {{flexDirection: 'row'}}>
				{array.map((item,i) => (
					<View style={{flexDirection: 'column'}}  key={i}>
						<View style = {{height: 8, borderLeftColor: 'black', borderLeftWidth: 1, flexDirection: 'column', width: D.LITHOLOGY_ADDING_TERM}}/>
					</View>
				))}
			</View>
		</View>
	)
}

/// Aquí creamos la regla de los no carbonatos, que puede mostrarse en el campo de litología de un estrato
// Es necesario que lo que retorne sea una clase Component de React para que luego pueda usarse su vista
export function createNoCarbonatesRule(language){
	return(
		class createNoCarbonatesRule extends Component{
			render() {
				return(
					<View style = {{flexDirection: 'column'}}>
						<View style = {{flexDirection: 'row', height: 15, paddingLeft: -14}}>
							{createHorizontalRule_Texts(language, true)} 
						</View>

						<View style = {{flexDirection: 'row', height: 10, paddingLeft: -1}}>
							{createHorizontalRule_Lines(language, true)}
						</View>

						{/*Esto es sólo para dejar espacio entre la regla y el estrato*/}
						<View style = {{height: 2}}/>
					</View>
				)
			}
		}
	)
}

/// Aquí creamos la regla de los carbonatos, que puede mostrarse en el campo de litología de un estrato
// Es necesario que lo que retorne sea una clase Component de React para que luego pueda usarse su vista
export function createCarbonatesRule(language){
	return(
		class createCarbonatesRule extends Component{
			render() {
				return(
					<View style = {{flexDirection: 'column'}}>
						<View style = {{flexDirection: 'row', height: 15, paddingLeft: -1}}>
							{createHorizontalRule_Lines(language, false)}
						</View>		

						<View style = {{flexDirection: 'row', height: 15, paddingLeft: -14}}>
							{createHorizontalRule_Texts(language, false)} 
						</View>	
					</View>
				)
			}
		}
	)
}