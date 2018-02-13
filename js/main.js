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
            // Запишем в пустой объект нашу коллекцию
            this.cars_collection = new CarsCollection;
            // Привязываем к объекту window нашу закешированную коллекцию
            window.cars_collection - this.cars_collection;
            // Запускаем зависисый список
            this.startSelect();
        },

        // Стартовая функция
        // Отрисовывает первый select с выбором бренда машины
        // Прослушивает собитые brandSelected и если
        // Оно наступило, то выводит следующий select с выбором модели машины
        startSelect: function () {
            // Создаем эземпляр класса
            this.selectBrandView = new SelectBrandView();
            // Даем возможность прослушать выбранный select 
            // И передать его значение в ф.-обработчик 
            // Не выполняется до наступления события brandSelected
            this.listenTo(this.selectBrandView, 'brandSelected', this.brandSelected);
            // Запускаем отрисовку нашего селекта
            this.selectBrandView.render(ALL_CARS);
        },

        // Функция - обработчик для события brandSelected
        // Отрисовывает второй select с выбором модели машины
        // Прослушивает собитые modelSelected и если
        // Оно наступило, то выводит коллекцию машин по выбранному бренду и модели
        brandSelected: function(brand){
            // Сохраним выбранный бренд машины
            this.brand_of_car = brand;
            // Очистим все, что нам нужно (вчастности, когда перевыбираем бренд)
            this.removeCollection(this.cars_collection.models);
            // Создаем эземпляр класса
            this.selectModelView = new SelectModelView();
            // Даем возможность прослушать выбранный select 
            // И передать его значение в ф.-обработчик 
            // Не выполняется до наступления события modelSelected
            this.listenTo(this.selectModelView, 'modelSelected', this.modelSelected);
            // Запускаем отрисовку нашего селекта
            this.selectModelView.render(ALL_CARS[brand]);
        },

        // Функция - обработчик для события modelSelected
        // Выводит коллекцию машин по выбранному бренду и модели
        modelSelected: function(model){
            // Сохраним выбранную модель машины
            this.model_of_car = model;

            // Предварительно чистим нашу коллекцию от предыдущих моделей
            this.removeCollection(this.cars_collection.models);
            
            // Старт вывода коллекции в зависимости от выбранного бренда и модели машины
            this.startViewCollectionCars(this.brand_of_car, this.model_of_car);

        },

        // Очистка коллекции от ненужных моделей (нужно, когда меняем марку или модель или оба параметра)
        removeCollection: function (models) {
            
            
            this.cars_collection.remove(models);
            this.$('.catalogs').html('');
            this.$('.tt').remove();
            this.$('.description').show();  
        },

        // Функция вывода коллекции в зависимости от выбранного бренда или модели
        startViewCollectionCars: function (brand_of_car, model_of_car) {
            // Обратимся к collection_cars.js и 
            // В зависимости от выбранного бренда
            var selected_car = COLLECTIONS_CARS[brand_of_car],
                // Отберем нужные нам модели
                selected_model = selected_car[model_of_car],
                // Созраним контекст нашего объекта
                self = this,
                // Нужен для правильного добавления в коллекцию
                // @TODO: в дальнейшем записывать в эту переменную id с сервера  
                id = 1,
                // Выьираем нужный шаблон с id=template_title
                template_of_title = _.template($("#template_title").html());

            // Скрываем описание, которое было до выбора МОДЕЛИ    
            this.$('.description').hide();

            // Передаем в наш шаблон название бренда и модели
            // Для отображения в h1 
            this.$('.catalogs').before(template_of_title({
                brand : brand_of_car,
                model: model_of_car
            }));
            
            // Создаем новый экземпляр класса, куда передаем
            List_of_cars = new ListOfCars({
                // Элемент данного контекста
                el: this.$el,
                // Колекцию в качестве модели
                model: this.cars_collection,
                // Название бренда машины
                brand_of_car: this.brand_of_car,
                // Название модели машины
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
                // Увеличиваем id на один
                id++;
            });
        }
    });
    
/*
 *
 * Модель (Model) машины 
 * 
 */
CarModel = Backbone.Model.extend({
    // Значения по умолчанию
    // В данном случае они пустые, так как
    // Мы сами выбираем и заполняем его

    // Дефолтные данные
    // Служат, допустим, для того, когда нет фотки машины
    // Загружает дефолтную 'Нет фото'
    defaults:{
        id: '',
        title: '',
        description: '',
        img: 'http://dummyimage.com/115',
        mileage: ''
    }
});

/*
 *
 * Вьюха выброра бренда машины 
 * 
 */

SelectBrandView = Backbone.View.extend({
    
    // Повесим события
    events: {
        // Повесим обработчик selectChange на событие change
        'change': 'selectChange'
    },

    // Функция-обработчик для события change при выборе в select бренда
    selectChange: function (){
        // Определяем переменную с выбранным значением из select data-car_brand
        var selected_brand = this.$(':selected').data('car_brand');

        // Вызываем событие brandSelected и передаем в качестве параметра
        // значение data-car_brand
        this.trigger('brandSelected', selected_brand);
    },

    // Функция отрисовки select'a и в качестве аргумента принимаем
    // весь наш объект ALL_CARS
    render: function (data) {
        // Кэшируем аргумент
        var cars = data,
        // Выбираем underscore шаблон с id=cars-select
            template = _.template($('#cars-select').html());
        
        // Вставляем внутрь элемента с классом car-block 
        // Наш шаблон и передаем в него параметр cars: закешированный(ALL_CARS)    
        $('.car-block').html(template({
            cars: cars
        }));

        // Задаем $el, который срендерили
        this.setElement('#cars-select_brand');
        // Применим к нашему id=cars-select_brand плагин SumoSelect
        this.$el.SumoSelect();
    }
    
});

/*
 *
 * Вьюха выброра модели машины 
 * 
 */

SelectModelView = Backbone.View.extend({

    // Повесим события
    events: {
        // Повесим обработчик selectChange на событие change
        'change': 'selectChange'
    },

    // Функция-обработчик для события change при выборе в select модели
    selectChange: function(){
        // Определяем переменную с выбранным значением из select data-car_brand
        var  selected_model = this.$(':selected').data('car_model');
            
        // Вызываем событие brandSelected и передаем в качестве параметра
        // значение data-car_model
        this.trigger('modelSelected', selected_model);
    },

    // Функция отрисовки select'a и в качестве аргумента принимаем
    // выбранные модели машины, зависящие от выбранного бренда
    // ALL_CARS[brand]
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

        this.$el.find('.catalogs').append(fields);

        return this;
        
    }
});

new TestBackbone;