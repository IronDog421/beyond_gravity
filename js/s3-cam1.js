

// Variables globales que van siempre
var renderer, scene, camera;
var cameraControls;
var angulo = -0.01;
var cameraTop;

// 1-inicializa 
init();
// 2-Crea una escena
loadScene();
// 3-renderiza
render();

function init()
{
  renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  document.getElementById('container').appendChild( renderer.domElement );

  scene = new THREE.Scene();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 1, 10000 );
  camera.position.set( 50, 30, 30 );

  // vista de planta
  cameraTop = new THREE.OrthographicCamera( -50, 50, 50,-50, 1, 1000 );
  cameraTop.position.set(0,500,0);  // 500 unidades arriba del origen
  cameraTop.lookAt( 0, 0, 0 ); // mirando al origen
  cameraTop.up.set( 0, 0, 1 ); // direccion "arriba" de la camara
  cameraTop.updateProjectionMatrix();  


  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 0, 0 );

  window.addEventListener('resize', updateAspectRatio );
}


function loadScene() {
    // Añadir un ayudante de ejes para visualizar el espacio 3D
    scene.add(new THREE.AxesHelper(15));

    // Crear y añadir un plano que actúe como suelo
    const planeGeometry = new THREE.PlaneGeometry(100, 100);
    const planeMaterial = new THREE.MeshBasicMaterial({color: 0x808080, side: THREE.DoubleSide});
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2; // Rotar el plano para que esté horizontal
    scene.add(plane);

    // Generar y añadir cubos como edificios
    for (let i = 0; i < 100; i++) {
        // Dimensiones aleatorias para los edificios
        const width = 3+ Math.random() * 5;
        const depth = 3+ Math.random() * 5;
        const height = Math.random() * 15 + 5; // Altura entre 5 y 20

        // Geometría y material para los edificios
        const boxGeometry = new THREE.BoxGeometry(width, height, depth);
        const boxMaterial = new THREE.MeshNormalMaterial();

        // Crear el mesh del edificio y posicionarlo
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.x = Math.random() * 100 - 50; // Posición aleatoria en X dentro del plano
        box.position.z = Math.random() * 100 - 50; // Posición aleatoria en Z dentro del plano
        box.position.y = height / 2; // Ajustar la posición en Y para que la base esté sobre el suelo

        // Añadir el edificio a la escena
        scene.add(box);
    }
}


function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

var time = 0;
function update()
{
    time += 0.01;
  // Cambios para actualizar la camara segun mvto del raton
  cameraControls.update();

  
}

function render()
{
	requestAnimationFrame( render );
	update();

    // vista 3d perspectiva
    renderer.autoClear = false; // para poder hacer varios viewports
    renderer.setViewport(0,0,window.innerWidth,window.innerHeight);
	renderer.setClearColor( new THREE.Color(0xa2a2f2) );
	renderer.clear();
	renderer.render( scene, camera );

    // vista de arriba
    var ds = Math.min(window.innerHeight , window.innerWidth)/4;
    renderer.setViewport(0,0,ds,ds); // esquina inferior izda
	renderer.setScissor (0, 0, ds, ds);
	renderer.setScissorTest (true);
	renderer.setClearColor( new THREE.Color(0xaffff) );
	renderer.clear();	
	renderer.setScissorTest (false);
    renderer.render(scene, cameraTop);




}