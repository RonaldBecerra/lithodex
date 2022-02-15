- Es preferible instalar todo con yarn en lugar de con npm por la rapidez. Pero
hay excepciones:
 * react-navigation,
 * react-native-picker-checkbox
 * shortid
        
Para esas excepciones usar npm install <paquete> --save
Si async-storage no se instala, revisa
https://github.com/react-native-community/async-storage

- Este proyecto se desarrolló con Expo. Asegurarse de que el dispositivo móvil y el
computador estén en la misma señal wifi.

Si aún no funciona, hacer port forwarding para el puerto de exp:... 
que sale en el CLI

- Problemas con expo:
https://github.com/expo/expo/issues/1381

- Tomar en cuenta que hay librerías de entrada/salida que no funcionan si se está
  utilizando Expo, por usar componentes nativos.

- Tutorial de Redux recomendado:
https://daveceddia.com/redux-tutorial/  

- No usar "this.props.navigation.push(...)" sino "this.props.navigation.navigate(...)"
porque de esa manera es posible pasar como argumento un identificador único "key", 
que permite que no se abra una misma ventana dos veces si el usuario pulsa un botón
para ir a otra ventana dos veces seguidas, antes de que se pueda cargar la siguiente
ventana. 

- Estar pendientes de la carpeta \node_modules\expo\build\launch

- En este enlace hay nombres de iconos para los botones de react-native-elements
cuando no se utiliza el componente Icon:
https://material.io/resources/icons/?icon=transit_enterexit&style=baseline



