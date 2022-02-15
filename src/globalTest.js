import {test as auxiliarFunctions_test} from './genericFunctions/otherFunctions'

export default function globalTest(){
	var boolean = true;

	// Pruebas
	boolean = auxiliarFunctions_test();

	return boolean;
}