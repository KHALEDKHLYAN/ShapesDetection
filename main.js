/*jshint esversion:6*/

$(function () {
    const video = $("video")[0];
    let model;
    let cameraMode = "environment"; // or "user"

    const startVideoStreamPromise = navigator.mediaDevices
        .getUserMedia({ audio: false, video: { facingMode: cameraMode } })
        .then(stream => new Promise(resolve => {
            video.srcObject = stream;
            video.onloadeddata = () => {
                video.play();
                resolve();
            };
        }));

    const publishable_key = "rf_TV1AXOV0jBYt02DPg0stwRyqeY13";
    const toLoad = { model: "shapes-recognition", version: 4 };

    const loadModelPromise = roboflow.auth({ publishable_key })
        .load(toLoad)
        .then(m => { model = m; });

    Promise.all([startVideoStreamPromise, loadModelPromise]).then(() => {
        $("body").removeClass("loading");
        resizeCanvas();
        detectFrame();
    });

    let canvas = $("<canvas/>")[0];
    const ctx = canvas.getContext("2d");
    const font = "16px sans-serif";

    function resizeCanvas() {
        const dimensions = videoDimensions(video);

        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        $(canvas).css({
            width: dimensions.width,
            height: dimensions.height,
            left: ($(window).width() - dimensions.width) / 2,
            top: ($(window).height() - dimensions.height) / 2
        });

        $("body").append(canvas);
    }

    function videoDimensions(video) {
        const videoRatio = video.videoWidth / video.videoHeight;
        let width = video.offsetWidth, height = video.offsetHeight;
        const elementRatio = width / height;

        if (elementRatio > videoRatio) {
            width = height * videoRatio;
        } else {
            height = width / videoRatio;
        }

        return { width, height };
    }

    function renderPredictions(predictions) {
        const scale = 1;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        predictions.forEach(prediction => {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;
            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            ctx.strokeStyle = prediction.color;
            ctx.lineWidth = 4;
            ctx.strokeRect((x - width / 2) / scale, (y - height / 2) / scale, width / scale, height / scale);

            ctx.fillStyle = prediction.color;
            const textWidth = ctx.measureText(prediction.class).width;
            const textHeight = parseInt(font, 10);
            ctx.fillRect((x - width / 2) / scale, (y - height / 2) / scale, textWidth + 8, textHeight + 4);
        });

        predictions.forEach(prediction => {
            const x = prediction.bbox.x;
            const y = prediction.bbox.y;
            const width = prediction.bbox.width;
            const height = prediction.bbox.height;

            ctx.font = font;
            ctx.textBaseline = "top";
            ctx.fillStyle = "#000000";
            ctx.fillText(prediction.class, (x - width / 2) / scale + 4, (y - height / 2) / scale + 1);
        });
    }

    let prevTime;
    let pastFrameTimes = [];

    function detectFrame() {
        if (!model) return requestAnimationFrame(detectFrame);

        model.detect(video)
            .then(predictions => {
                requestAnimationFrame(detectFrame);
                renderPredictions(predictions);

                if (prevTime) {
                    pastFrameTimes.push(Date.now() - prevTime);
                    if (pastFrameTimes.length > 30) pastFrameTimes.shift();

                    const total = pastFrameTimes.reduce((acc, t) => acc + t / 1000, 0);
                    const fps = pastFrameTimes.length / total;
                    $("#fps").text(Math.round(fps));
                }
                prevTime = Date.now();
            })
            .catch(e => {
                console.error("Error:", e);
                requestAnimationFrame(detectFrame);
            });
    }
});
