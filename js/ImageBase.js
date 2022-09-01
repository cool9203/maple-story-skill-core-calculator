/** 
 * example for convert Image to cv.Mat
 * @params {string/image} element
 * @returns cv.Mat
 */ 
function convert_image_data_to_opencv_mat(element){
    if (element.constructor.name == "HTMLImageElement"){
        let temp_canvas = document.createElement("canvas");
        util.draw_image(element, temp_canvas);
        let mat = cv.imread(temp_canvas);
        delete temp_canvas;
        return mat;

    }else if (element.constructor.name == "String"){
        return cv.imread(element);
    }else{
        throw "function convert_image_data_to_opencv_mat need pass canvas id or Image.";
    }
}


/** 
 * get all similar region for template in src when similar value over threshold.
 * @params {cv.Mat} src
 * @params {cv.Mat} templ
 * @params {double} threshold
 * @returns array
 */ 
function get_all_similar_region(src, templ, threshold, std=undefined){
    let topk_region = new Array();
    let src_g = new cv.Mat();
    let templ_g = new cv.Mat();

    //preprocess with laplacian to get high precision.
    cv.cvtColor(src, src_g, cv.COLOR_RGB2GRAY, 0);
    cv.cvtColor(templ, templ_g, cv.COLOR_RGB2GRAY, 0);
    cv.Laplacian(src_g, src_g, cv.CV_8U, 1, 1, 0, cv.BORDER_DEFAULT);
    cv.Laplacian(templ_g, templ_g, cv.CV_8U, 1, 1, 0, cv.BORDER_DEFAULT);

    dst = image_similarity(src_g, templ_g, false, true);
    max_point_list = get_image_point(dst, threshold, std);

    for (i = 0; i < max_point_list.length; i++){
        region = image_cut(src, max_point_list[i].x, max_point_list[i].y, templ.cols, templ.rows);
        topk_region.push(region);
    }

    src_g.delete();
    templ_g.delete();

    return topk_region;
}


/** 
 * get topk similar region for template in src.
 * @params {cv.Mat} src
 * @params {cv.Mat} templ
 * @params {int} k
 * @returns array
 */ 
 function get_topk_similar_region(src, templ, k){
    let topk_region = new Array();
    let src_g = new cv.Mat();
    let templ_g = new cv.Mat();

    //preprocess with laplacian to get high precision.
    cv.cvtColor(src, src_g, cv.COLOR_RGB2GRAY, 0);
    cv.cvtColor(templ, templ_g, cv.COLOR_RGB2GRAY, 0);
    cv.Laplacian(src_g, src_g, cv.CV_8U, 1, 1, 0, cv.BORDER_DEFAULT);
    cv.Laplacian(templ_g, templ_g, cv.CV_8U, 1, 1, 0, cv.BORDER_DEFAULT);

    dst = image_similarity(src_g, templ_g, false, true);
    max_point_list = get_image_topk_point(dst, k);

    for (i = 0; i < max_point_list.length; i++){
        region = image_cut(src, max_point_list[i].x, max_point_list[i].y, templ.cols, templ.rows);
        topk_region.push(region);
    }

    src_g.delete();
    templ_g.delete();

    return topk_region;
}


/** 
 * select a rectangle to get region in src(type is image).
 * @params {cv.Mat} src
 * @params {int} start_x
 * @params {int} start_y
 * @params {int} end_x
 * @params {int} end_y
 * @returns cv.Mat
 */ 
function image_cut(src, start_x, start_y, end_x, end_y){
    let rect = new cv.Rect(start_x, start_y, end_x, end_y);
    let roi = src.roi(rect);
    return roi;
}


/** 
 * get image top k similar point. 
 * if need get smallest, compare need change to '<'.
 * @params {cv.Mat} src
 * @params {int} k
 * @params {function} compare
 * @returns array
 */ 
function get_image_topk_point(src, k, compare=(a, b) => a.value > b.value){
    let topk = new util.insert_sort(k, compare);

    for (let row = 0; row < src.rows; row++){
        for (let col = 0; col < src.cols; col++){
            let value = src.row(row).col(col).data32F[0];

            //init point and insert point to topk
            let point = new util.point();
            point.x = col;
            point.y = row;
            point.value = value;
            topk.insert(point);
        }
    }
    return topk.get();
}


/** 
 * get all image similar point when similar over threshold. 
 * std can filtrate high similar value point. suggest use 4.
 * if need get smallest, compare need change to '<'.
 * @params {cv.Mat} src
 * @params {int} threshold
 * @params {function} compare
 * @returns array
 */ 
 function get_image_point(src, threshold, std=undefined, compare=(a, b) => a.value > b.value){
    let all_point_arr = new Array();
    let value_arr = new Array();
    let filter_point_arr = new Array();

    for (let row = 0; row < src.rows; row++){
        for (let col = 0; col < src.cols; col++){
            let value = src.row(row).col(col).data32F[0];

            if (value >= threshold){
                //console.log(value);   //dev
                value_arr.push(value);
                
                //init point and insert point to array
                let point = new util.point();
                point.x = col;
                point.y = row;
                point.value = value;
                all_point_arr.push(point);
            }
        }
    }

    if (std != undefined){
        std_value = util.std(value_arr);
        //console.log(`std_value:${std_value}`);    //dev

        for (let i = 0; i < value_arr.length; i++){
            if (value_arr[i] >= std_value * std){
                filter_point_arr.push(all_point_arr[i]);
            }
        }
        return filter_point_arr;
    }else{
        return all_point_arr;
    }
}


/** 
 * calc two images similarity.
 * if image_index = false, will get similarity value.
 * if image_index = true, will get similar point and similarity value
 * if get_dst = true, will only get after similarity image.
 * @params {cv.Mat} src
 * @params {cv.Mat} templ
 * @params {bool} image_index
 * @params {bool} get_dst
 * @returns cv.Mat or double or [cv.point, double]
 */ 
function image_similarity(src, templ, image_index=false, get_dst=false){
    let dst = new cv.Mat();   
     
    cv.matchTemplate(src, templ, dst, cv.TM_CCOEFF_NORMED);

    if (get_dst == true){
        return dst;
    }

    let result = cv.minMaxLoc(dst);
    
    dst.delete();

    if (image_index == true){
        return [result.maxLoc, result.maxVal];
    }
    else{
        return result.maxVal;
    }
}