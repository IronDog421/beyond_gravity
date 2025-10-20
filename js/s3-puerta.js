

// Variables globales que van siempre
var renderer, scene, camera;
var cameraControls;
var angulo = -0.01;

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
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 0.1, 100 );
  camera.position.set( 5, 10, 20 );

  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 0, 0 );

  window.addEventListener('resize', updateAspectRatio );

}


function loadScene() {
    ancho = 0.1
    largo = 5
    alto = 10
    caja1 = new THREE.Mesh(new THREE.BoxGeometry(largo,alto,ancho), new THREE.MeshNormalMaterial());
    scene.add(caja1);
    scene.add( new THREE.AxesHelper(15 ) );

}


function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

var time = 0;
var angulo = Math.PI/4;
function update()
{
    time += 0.01;
    cameraControls.update();


    let Tx = new THREE.Matrix4();
    Tx.makeTranslation(largo*1.5, 5, 0);

    let Rx = new THREE.Matrix4();
    Rx.makeRotationY( Math.sin(time) * angulo );


    // Combinar todas las transformaciones
    let M = new THREE.Matrix4();

    M.multiply(Rx);
    M.multiply(Tx);

    // M = Rx x Rz

    // Aplicar la transformación  al objeto
    caja1.matrix.identity();  // Limpiar la matriz actual
    caja1.applyMatrix4(M);    // Aplicar la matriz de transformación combinada
    caja1.matrixAutoUpdate = false;  // Desactivar la actualización automática de la matriz


  
}

function render()
{
	requestAnimationFrame( render );
	update();
	renderer.render( scene, camera );
}