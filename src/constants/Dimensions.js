import { Dimensions } from 'react-native';

// Ancho de la pantalla del teléfono
export const GLOBAL_SCREEN_WIDTH = Dimensions.get('window').width;  

// Alto de la pantalla del teléfono
export const GLOBAL_SCREEN_HEIGHT = Dimensions.get('window').height; 

// Mínimo entre el alto y el ancho del teléfono
export const MIN_GLOBAL_DIMENSION = (GLOBAL_SCREEN_WIDTH <= GLOBAL_SCREEN_HEIGHT) ? GLOBAL_SCREEN_WIDTH : GLOBAL_SCREEN_HEIGHT;

// Determina cuál de las dos dimensiones es mínima
export const WIDTH_IS_MIN = (GLOBAL_SCREEN_WIDTH <= GLOBAL_SCREEN_HEIGHT) ? true : false;

// -------------------- Dimensiones de los componentes de las columnas estratigráficas y demás gráficas ---------------

// Las siguientes variables son anchuras
export const STRATUM_INFORMATION_WIDTH = 240;
export const LITHOLOGY_PICKER_WIDTH    = 470;
export const STRUCTURE_PICKER_WIDTH    = 225; 
export const FOSSIL_PICKER_WIDTH       = 275;
export const IMAGE_PICKER_WIDTH        = 300;
export const NOTE_WRITER_WIDTH         = 370;
export const GAMMA_RAY_WIDTH           = 280;

// Tamaño en pantalla que representa lo que aquí llamamos unidad. Ej: si la escala es 1:10 (metros), entonces 10 metros ocuparían 65.
export const SIZE_OF_UNIT = 65; 

// Diferencia de anchura entre un tamaño de grano y otro, en el caso de la imagen que representa las litologías
// Esto es igual a 60 en este caso. El 50 es el tamaño de la primera imagen, y 7 es el número de tipos de no 
// carbonatos que están registrados en la aplicación
export const LITHOLOGY_ADDING_TERM = (LITHOLOGY_PICKER_WIDTH - 50)/ 7; 

// Dimensiones de las imágenes de fósiles que se muestran en la ventana de una columna estratigráfica
export const GLOBAL_SIZE_FOSSIL_IMAGE = 50;