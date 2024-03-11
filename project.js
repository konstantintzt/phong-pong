import {defs, tiny} from './examples/common.js';
const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene, Texture,
} = tiny;

import {getAABB, intersectSphereAABB, intersectSphereSphere} from './utils.js';

const {Cube, Axis_Arrows, Textured_Phong, Normal_Map} = defs

export class PhongPong extends Scene {
    constructor() {
        super();
        // Shapes
        this.shapes = {
            racket: new defs.Cube(),
            ball: new defs.Subdivision_Sphere(4),
            background: new defs.Cube()
        };

        // Materials
        this.materials = {
            yellow: new Material(new defs.Phong_Shader(), {ambient: .5, diffusivity: .8, color: hex_color("#FFFF00")}),
            red: new Material(new defs.Phong_Shader(), {ambient: .5, diffusivity: .5, color: hex_color("#FF0000")}),
            green: new Material(new defs.Phong_Shader(), {ambient: .5, diffusivity: .5, color: hex_color("#00FF00")}),
            blue: new Material(new defs.Phong_Shader(), {ambient: .5, diffusivity: .5, color: hex_color("#0000FF")}),
            textured_gold: new Material(new Textured_Phong(), {color: hex_color("000000"), ambient: .8, diffusivity: .5, texture: new Texture('assets/gold_texture.jpg', 'LINEAR_MIPMAP_LINEAR')}),
            textured_ruby: new Material(new Textured_Phong(), {color: hex_color("000000"), ambient: .8, diffusivity: .5, texture: new Texture('assets/ruby_texture.jpg', 'LINEAR_MIPMAP_LINEAR')}),
            textured_emerald: new Material(new Textured_Phong(), {color: hex_color("000000"), ambient: .8, diffusivity: .5, texture: new Texture('assets/emerald_texture.jpg', 'LINEAR_MIPMAP_LINEAR')}),

            background: new Material(new defs.Phong_Shader(), {ambient: .5, diffusivity: .5, color: hex_color("#FFFFFF")}),
            background1: new Material(new defs.Textured_Phong(), {ambient: .5, diffusivity: .5, color: hex_color("#FFFFFF") , texture: new Texture('assets/NeonBackground.jpg', 'LINEAR_MIPMAP_LINEAR')}),
            normal_background: new Material(new defs.Normal_Map(),
                {
                    ambient: 1, color: hex_color("#000000"),
                    texture: new Texture('assets/neon.png', 'NEAREST'),
                    normal_map: new Texture('assets/normal.png', 'NEAREST')
                }
            )
        }

        // Powerups
        this.powerups = [
            {
                "color": hex_color("#FF0000"),
                "probability": "0.1",
                "type": "increase_ball_speed"
            },
            {
                "color": hex_color("#00FF00"),
                "probability": "0.4",
                "type": "random_ball_angle"
            },
            {
                "color": hex_color("#0000FF"),
                "probability": "0.7",
                "type": "decrease_racket_size"
            },
            {
                "color": hex_color("#FF00FF"),
                "probability": "1.0",
                "type": "increase_racket_speed"
            }
        ]

        // Initial scene positions
        this.initial_camera_location = Mat4.look_at(vec3(0, 0, 20), vec3(0, 0, 0), vec3(0, 1, 0));
        this.racket1 = Mat4.identity().times(Mat4.translation(-12, 0, 0))
        this.racket2 = Mat4.identity().times(Mat4.translation(12, 0, 0))
        this.ball = Mat4.identity()
        this.background = Mat4.identity().times(Mat4.scale(20, 20, 1)).times(Mat4.translation(0, 0, -7.5))
        this.left = Mat4.identity().times(Mat4.translation(-14.5, 0, 0)).times(Mat4.scale(1, 20, 20))
        this.right = Mat4.identity().times(Mat4.translation(14.5, 0, 0)).times(Mat4.scale(1, 20, 20))
        this.top = Mat4.identity().times(Mat4.translation(0, 8.5, 0)).times(Mat4.scale(20, 1, 20))
        this.bottom = Mat4.identity().times(Mat4.translation(0, -8.5, 0)).times(Mat4.scale(20, 1, 20))

        // Racket movement controls
        this.a = 1.2;
        this.max_v = 0.2;
        this.player1_v = 0;
        this.player2_v = 0;
        this.d = 0.95;

        // Key controls
        this.player1_up = false;
        this.player1_down = false;
        this.player2_up = false;
        this.player2_down = false;

        // Gameplay changers
        this.active_powerups = [];

        // Game params
        this.ball_angle = Math.random() * 2 * Math.PI;
        this.ball_speed = 0.2;
        this.racket_size = 2.5;
        this.game_over = false;

    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Pause/Resume", ["Escape"], () => {
            if (this.attached !== undefined) {
                this.attached = undefined; // Resume animation
            } else {
                this.attached = true; // Pause animation
            }
        });
        this.new_line();
        this.key_triggered_button("Player 1 UP", ["w"], () => {
            this.player1_up = true;
            this.player1_down = false;
        }, undefined, () => {
            this.player1_up = false
            this.player1_down = false;
        });
        this.key_triggered_button("Player 2 UP", ["ArrowUp"], () =>
        {
            this.player2_up = true;
            this.player2_down = false;
        }, undefined, () => {
            this.player2_up = false
            this.player2_down = false;
        });
        this.new_line();
        this.key_triggered_button("Player 1 DOWN", ["s"], () => {
            this.player1_down = true;
            this.player1_up = false;
        }, undefined, () => {
            this.player1_down = false;
            this.player1_up = false;
        });
        this.key_triggered_button("Player 2 DOWN", ["ArrowDown"], () => {
            this.player2_down = true;
            this.player2_up = false;
        }, undefined, () => {
            this.player2_down = false;
            this.player2_up = false;
        });
    }

    display(context, program_state) {
        // Initial camera setup
        program_state.set_camera(this.initial_camera_location);
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);

        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;


        // Racket 1 movement
        if (this.attached !== undefined) { //When paused
            return;
        }
        if (this.game_over) {
            // Display game over message or perform any other actions needed
            return;
        }
        this.player1_v *= this.d;
        if (this.player1_up) {
            this.player1_v += this.a;
            if (this.player1_v > this.max_v) {
                this.player1_v = this.max_v;
            }
        }
        else if (this.player1_down) {
            this.player1_v -= this.a;
            if (this.player1_v < -this.max_v) {
                this.player1_v = -this.max_v;
            }
        }

        // Racket 2 movement
        this.player2_v *= this.d;
        if (this.player2_up) {
            this.player2_v += this.a;
            if (this.player2_v > this.max_v) {
                this.player2_v = this.max_v;
            }
        }
        else if (this.player2_down) {
            this.player2_v -= this.a;
            if (this.player2_v < -this.max_v) {
                this.player2_v = -this.max_v;
            }
        }

        // Move racket 1
        let racket1_transform = this.racket1.times(Mat4.translation(0, this.player1_v, 0))
        if (racket1_transform[1][3] >= 7.5 - this.racket_size) {
            racket1_transform[1][3] = 7.5 - this.racket_size;
            this.player1_v = 0;
        }
        if (racket1_transform[1][3] <= -(7.5 - this.racket_size)) {
            racket1_transform[1][3] = -(7.5 - this.racket_size);
            this.player1_v = 0;
        }
        racket1_transform = racket1_transform.times(Mat4.scale(1, this.racket_size, 1));

        // Move racket 2
        let racket2_transform = this.racket2.times(Mat4.translation(0, this.player2_v, 0))
        if (racket2_transform[1][3] >= 7.5 - this.racket_size) {
            racket2_transform[1][3] = 7.5 - this.racket_size;
            this.player2_v = 0;
        }
        if (racket2_transform[1][3] <= -(7.5 - this.racket_size)) {
            racket2_transform[1][3] = -(7.5 - this.racket_size);
            this.player2_v = 0;
        }
        racket2_transform = racket2_transform.times(Mat4.scale(1, this.racket_size, 1));

        // Ball movement
        let ball_direction = [Math.cos(this.ball_angle), Math.sin(this.ball_angle)]
        let ball_transform = this.ball;
        ball_transform = ball_transform.times(Mat4.translation(this.ball_speed*ball_direction[0], this.ball_speed*ball_direction[1], 0))

        // Collision detection preparation
        let ball_center = vec3(ball_transform[0][3], ball_transform[1][3], ball_transform[2][3]);
        let racket1_AABB = getAABB(vec3(1, this.racket_size, 1), vec3(racket1_transform[0][3], racket1_transform[1][3], racket1_transform[2][3]));
        let racket2_AABB = getAABB(vec3(1, this.racket_size, 1), vec3(racket2_transform[0][3], racket2_transform[1][3], racket2_transform[2][3]));
        let background_AABB = getAABB(vec3(20, 20, 1), vec3(this.background[0][3], this.background[1][3], this.background[2][3]));
        let left_AABB = getAABB(vec3(1, 20, 20), vec3(this.left[0][3], this.left[1][3], this.left[2][3]));
        let right_AABB = getAABB(vec3(1, 20, 20), vec3(this.right[0][3], this.right[1][3], this.right[2][3]));
        let top_AABB = getAABB(vec3(30, 1, 20), vec3(this.top[0][3], this.top[1][3], this.top[2][3]));
        let bottom_AABB = getAABB(vec3(30, 1, 20), vec3(this.bottom[0][3], this.bottom[1][3], this.bottom[2][3]));

        // Racket 1 collision
        if (intersectSphereAABB(racket1_AABB, ball_center, 1.0)) {
            // Change ball angle by a bigger angle the higher the racket1_v is
            let angle_change = 0.5 * Math.abs(this.player1_v);
            if (this.player1_v < 0) angle_change = -angle_change;
            this.ball_angle = (Math.PI - this.ball_angle + angle_change) % (2 * Math.PI);
        }

        // Racket 2 collision
        if (intersectSphereAABB(racket2_AABB, ball_center, 1.0)) {
            // Change ball angle by a bigger angle the higher the racket2_v is
            let angle_change = 0.5 * Math.abs(this.player2_v);
            if (this.player2_v < 0) angle_change = -angle_change;
            this.ball_angle = (Math.PI - this.ball_angle + angle_change) % (2 * Math.PI);
        }

        // Top and bottom collision
        if (intersectSphereAABB(top_AABB, ball_center, 1.0) || intersectSphereAABB(bottom_AABB, ball_center, 1.0)) {
            this.ball_angle = -this.ball_angle;
        }

        // Left collision
        if (intersectSphereAABB(left_AABB, ball_center, 1.0)) {
            console.log("Player 2 wins!");
            this.game_over = true;
            alert("Player 2 wins!")
            return;

        }
        // Right collision
        if (intersectSphereAABB(right_AABB, ball_center, 1.0)) {
            console.log("Player 1 wins!");
            this.game_over = true;
            alert("Player 1 wins!")
            return;

        }

        // Add lights to the scene
        program_state.lights = [
            new Light(vec4(0, 15, 0, 1), color(1, 1, 1, 1), 1000),
            new Light(vec4(ball_transform[0][3], ball_transform[1][3], -5, 1), color(0, 0, 1, 1), 100)
        ];

        // Powerup generation
        if (t != 0 && t%5 < 0.01 && this.active_powerups.length < 5) {
            let x = Math.random() * 20 - 10;
            let y = Math.random() * 5 - 5;
            let powerup_transform = Mat4.identity().times(Mat4.translation(x, y, 0)).times(Mat4.scale(0.5, 0.5, 0.5));
            for (let i = 0; i < this.powerups.length; i++) {
                if (Math.random() < this.powerups[i]["probability"]) {
                    this.active_powerups.push({
                        "transform": powerup_transform,
                        "color": this.powerups[i]["color"],
                        "type": this.powerups[i]["type"]
                    });
                    break;
                }
            }
        }

        // Player racket rendering
        this.shapes.racket.draw(context, program_state, racket1_transform, this.materials.textured_emerald);
        this.shapes.racket.draw(context, program_state, racket2_transform, this.materials.textured_ruby);

        // Ball rendering
        this.shapes.ball.draw(context, program_state, ball_transform, this.materials.textured_gold);
        this.shapes.ball.arrays.texture_coord = this.shapes.ball.arrays.position;

        this.shapes.background.arrays.texture_coord.forEach((v, i, l) => {
            v[0] = v[0] * 5;
            v[1] = v[1] * 5;
        });

        // Background rendering
        this.shapes.background.draw(context, program_state, this.background, this.materials.normal_background);
        this.shapes.background.draw(context, program_state, this.left, this.materials.normal_background);
        this.shapes.background.draw(context, program_state, this.right, this.materials.normal_background);
        this.shapes.background.draw(context, program_state, this.top, this.materials.normal_background);
        this.shapes.background.draw(context, program_state, this.bottom, this.materials.normal_background);

        // Powerups rendering
        for (let powerup of this.active_powerups) {
            this.shapes.ball.draw(context, program_state, powerup["transform"], this.materials.blue.override({color: powerup["color"]}));
        }

        // Powerups collision
        let old_racket_size = this.racket_size;
        for (let i = this.active_powerups.length - 1; i >= 0; i--) {
            let powerup_center = vec3(this.active_powerups[i]["transform"][0][3], this.active_powerups[i]["transform"][1][3], this.active_powerups[i]["transform"][2][3]);
            if (intersectSphereSphere(powerup_center, 0.5, ball_center, 1.0)) {
                const powerup_type = this.active_powerups[i]["type"];
                if (powerup_type == "increase_ball_speed") {
                    this.ball_speed = 1.5 * this.ball_speed;
                }
                else if (powerup_type == "random_ball_angle") {
                    this.ball_angle = Math.random() * 2 * Math.PI;
                }
                else if (powerup_type == "decrease_racket_size") {
                    this.racket_size = this.racket_size / 1.5;
                }
                else if (powerup_type == "increase_racket_speed") {
                    this.max_v = 1.5 * this.max_v;
                }
                this.active_powerups.splice(i, 1);
                break;
            }
        }


        // Update saved transforms
        this.racket1 = racket1_transform.times(Mat4.scale(1, 1/old_racket_size, 1));
        this.racket2 = racket2_transform.times(Mat4.scale(1, 1/old_racket_size, 1));
        this.ball = ball_transform;
    }
}

class Gouraud_Shader extends Shader {
    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return ` 
        precision mediump float;
        const int N_LIGHTS = ` + this.num_lights + `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;

        // Specifier "varying" means a variable's final value will be passed from the vertex shader
        // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
        // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 N, vertex_worldspace, vertex_color;

        // ***** PHONG SHADING HAPPENS HERE: *****                                       
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
            // phong_model_lights():  Add up the lights' contributions.
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++){
                // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                // light will appear directional (uniform direction from all points), and we 
                // simply obtain a vector towards the light by directly using the stored value.
                // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                // the point light's location from the current surface point.  In either case, 
                // fade (attenuate) the light as the vector needed to reach it gets longer.  
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                               light_positions_or_vectors[i].w * vertex_worldspace;                                             
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                // Compute the diffuse and specular components from the Phong
                // Reflection Model, using Blinn's "halfway vector" method:
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                
                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;
                result += attenuation * light_contribution;
            }
            return result;
        } `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
            attribute vec3 position, normal;                            
            // Position is expressed in object coordinates.
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
    
            void main(){                                                                   
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                vertex_color = phong_model_lights( N, vertex_worldspace );
            } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            void main(){                                                           
                gl_FragColor = vec4( vertex_color.xyz, 1.0 );
            } `;
    }

    send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
        // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
        // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
        // program (which we call the "Program_State").  Send both a material and a program state to the shaders
        // within this function, one data field at a time, to fully initialize the shader for a draw.

        const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}
