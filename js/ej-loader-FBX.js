// ejemplo loader

var loader;
var renderer, scene, camera;
var cameraControls;
var angulo = -0.01;
var mixer = null;
const clock = new THREE.Clock();



init();
render();


function init()
{
  renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  document.getElementById('container').appendChild( renderer.domElement );

  scene = new THREE.Scene();

  // cargo el objeto
  loadObjFBX();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 1, 1000 );
  camera.position.set( 100, 150, 200 );

  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 0, 0 );

  const light = new THREE.PointLight(0xffffff, 1, 100);
  light.position.set(50, 50, 50);
  scene.add(light);
  
  // O también una luz ambiental para afectar a todos los objetos de manera uniforme
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);
  

  window.addEventListener('resize', updateAspectRatio );
}

function loadObjFBX()
{
       // Cargar el archivo FBX
       const loader = new THREE.FBXLoader();
       //const loader = new FBXLoader();
       //const model = 'models/girl/Dancing Twerk.fbx';
       //const model = 'models/swat/Firing Rifle.fbx';
       const model = '../models/Jumping Down.fbx';
       //const model = 'models/helicoptero/Helicopter3.fbx';
       loader.load(model, function (object) {
           
                // Ajustar materiales para evitar transparencias no deseadas
                object.traverse(function (child) {
                    if (child.isMesh) {
                        const material = child.material;
                        if (material) {
                            material.transparent = false;
                            material.opacity = 1.0;
                        }
                    }
                });
        
                mixer = new THREE.AnimationMixer(object);
                const action = mixer.clipAction(object.animations[0]);
                action.play();
                scene.add(object);
                object.position.set(0, 0, 0);
       }, undefined, function (error) {
           console.error(error);
       });
}


function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function update()
{
    // Cambios para actualizar la camara segun mvto del raton
    cameraControls.update();
    const delta = clock.getDelta();
    if (mixer!=null) mixer.update(delta);

}

function render()
{
	requestAnimationFrame( render );
	update();
	renderer.render( scene, camera );
}

