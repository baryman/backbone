var ALL_CARS = Cars,
    COLLECTIONS_CARS = Collection_cars,
    SelectCarsView,
    ListOfCars,
    ViewOfCar,
    CarsCollection = Backbone.Collection.extend({}),
    TestBackbone = Backbone.View.extend({
        el: $('#dependent_lists'),

        cars_collection: {},
        brand_of_car: {},
        model_of_car: {},
        selectCarsView: {},
        selectModelView: {},

        initialize: function () {
            this.cars_collection = new CarsCollection;
            window.cars_collection - this.cars_collection;
            this.startSelect();
        },

        startSelect: function () {
            this.selectBrandView = new SelectBrandView();
            this.listenTo(this.selectBrandView, 'brandSelected', this.brandSelected);
            this.selectBrandView.render(ALL_CARS);
        },

        brandSelected: function(brand){
            this.brand_of_car = brand;
            this.removeCollection(this.cars_collection.models);
            this.selectModelView = new SelectModelView();
            this.listenTo(this.selectModelView, 'modelSelected', this.modelSelected);
            this.selectModelView.render(ALL_CARS[brand]);
        },

        modelSelected: function(model){
            this.model_of_car = model;

            // Предварительно чистим нашу коллекцию от предыдущих моделей
            this.removeCollection(this.cars_collection.models);
            
            this.startViewCollectionCars(this.brand_of_car, this.model_of_car);

        },

        removeCollection: function (models) {
            
            
            this.cars_collection.remove(models);
            this.$('.catalogs').html('');
            this.$('.tt').remove();
            this.$('.description').show();  
        },

        startViewCollectionCars: function (brand_of_car, model_of_car) {
            var selected_car = COLLECTIONS_CARS[brand_of_car],
                selected_model = selected_car[model_of_car],
                self = this,
                id = 1,
                template_of_title = _.template($("#template_title").html());

            this.$('.description').hide();
            this.$('.catalogs').before(template_of_title({
                brand : brand_of_car,
                model: model_of_car
            }));    
            
            List_of_cars = new ListOfCars({
                el: this.$el,
                model: this.cars_collection,
                brand_of_car: this.brand_of_car,
                model_of_car: this.model_of_car
            });
                     
            // Загружаем новые данные в коллецию
            _.each(selected_model, function (car, index) {
                
              self.cars_collection.add(new CarModel({
                    id: id,
                    title: car.title,
                    description: car.description,
                    img: car.img,
                    mileage: car.mileage
               }));

               id++;
            });
        }
    });
    
    
    

CarModel = Backbone.Model.extend({
    defaults:{
        id: '',
        title: '',
        description: '',
        img: 'http://dummyimage.com/115',
        mileage: ''
    }
});

SelectBrandView = Backbone.View.extend({
    
    events: {
        'change': 'selectChange'
    },

    selectChange: function (){
        var selected_brand = this.$(':selected').data('car_brand');

        this.trigger('brandSelected', selected_brand);
    },

    render: function (data) {
        var cars = data,
            template = _.template($('#cars-select').html());
        
        $('.car-block').html(template({
            cars: cars
        }));
        // Задаем $el, который срендерили
        this.setElement('#cars-select_brand');
        this.$el.SumoSelect();
    }
    
});

SelectModelView = Backbone.View.extend({
    events: {
        'change': 'selectChange'
    },

    selectChange: function(){
        var  selected_model = this.$(':selected').data('car_model');
            this.trigger('modelSelected', selected_model);
    },
    render: function(selectedBrand){
        var models = selectedBrand.models,
            template = _.template($('#model-select').html());


        $('.model-block').html(template({
            models: models
        }));

        this.setElement('#cars-select_model');
        this.$el.SumoSelect();

    }
});

ViewOfCar = Backbone.View.extend({
    model: new CarModel(),
    tagName: 'div',
    className: 'lot',
    template: _.template($('#cars-list').html()),
    render: function () {

        this.$el.html(this.template({
            id: this.model.get('id'),
            title: this.model.get('title'),
            description: this.model.get('description'),
            img: this.model.get('img'),
            mileage: this.model.get('mileage')
        }));

        console.log(this.model);

        return this;
    }
})

ListOfCars = Backbone.View.extend({
    initialize: function(params){
        this.params = params || {};
        this.model.off();
        this.listenTo(this.model, 'add', function(element){
            this.render(element);
        });
    },

    render: function (element) {
        var fields = (new ViewOfCar({
            model: element
        })).render().$el;
        console.log(this.model.defaults);
        this.$el.find('.catalogs').append(fields);

        return this;
        
    }
});

new TestBackbone;