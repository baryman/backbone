var AMO_API_METHODS = allMethods,
    SelectAccountView,
    SelectMethodView,
    FieldListView,
    MainSelectView,
    FieldView,
    Field,
    FieldCollection = Backbone.Collection.extend({}),
    ConsoleView = Backbone.View.extend({
        // Создает виртуальный DOM - <div class="dev-console"></div>
        el: $('.dev-console'),
        fieldCollection: {},
        selectAccountView: {},
        selectMethodView: {},
        accountCurrent: {},
        selectedMethodName: {},
        consoleHelper: {},
        copyObject: {},

        initialize: function () {
            this.fieldCollection = new FieldCollection();
            window.fieldCollection = this.fieldCollection;
            this.accountsList();
        },

        removeControlElements: function () {
            this.$('.delete_field').trigger('click');
            this.$('.generate-button').off();
            this.$('.control-menu').addClass('hide-block');
            this.$('#generate_code').off();
        },

        accountsList: function () {
            var self = this;

            $.ajax({
                url: '/v3/accounts/',
                method: 'get'
            }).done(function (data) {
                self.selectAccountView = new SelectAccountView();
                self.listenTo(self.selectAccountView, 'accountSelected', self.accountSelected);
                self.selectAccountView.render(data);
            });
        },

        accountSelected: function (accountCurrent) {
            var self = this,
                account_response;

            this.$el.find('.console-description-block').show();
            this.removeControlElements();

            ConsoleHelper.hideCurrentLink();
            ConsoleHelper.request({
                get_account: accountCurrent,
                type: 'get_account',
                base_link: ConsoleHelper.getBaseUrl(accountCurrent)
            }).then(function (response) {
                account_response = JSON.parse(response).response;

                if (!account_response.error && account_response.account) {
                    self.accountCurrent = account_response.account;
                    self.selectMethodView = new SelectMethodView();
                    self.listenTo(self.selectMethodView, 'methodSelected', self.methodSelected);
                    self.selectMethodView.render(self.accountCurrent);

                    this.$('select').SumoSelect();
                } else {
                    ConsoleHelper.renderModal({
                        title: account_response.error,
                        error: true
                    });
                }

            }).catch(function (error) {
                ConsoleHelper.renderModal({
                    title: error.message,
                    status: error.status || null,
                    error: true
                });
            });
        },

        methodSelected: function (selectedMethodName) {
            var self = this,
                widget_methods = ['widgets_install', 'widgets_list'];

            this.removeControlElements();

            this.$el.find('.console-description-block').hide();

            this.selectedMethodName = selectedMethodName;
            new Promise(function (resolve) {
                if (widget_methods.indexOf(self.selectedMethodName) !== -1 && !self.accountCurrent.widgets_list) {
                    $.ajax({
                        url: 'console.php',
                        method: 'post',
                        data: {
                            type: 'list',
                            json: ConsoleHelper.getBaseUrl() + 'private/api/v2/json/widgets/list',
                            current_account: self.accountCurrent.subdomain
                        }
                    }).done(function (data) {
                        self.accountCurrent.widgets_list = JSON.parse(data).response.widgets;
                        resolve();
                    });
                } else {
                    resolve();
                }
            }).then(function () {
                self.startConsole(self.selectedMethodName, self.accountCurrent);
            });
        },

        requireFields: function () {
            var need_fill = false;

            _.each(self.fieldCollection.models, function (model) {
                if (model.get('require') === 'Y' && _.isEmpty(model.get('values')) && _.isEmpty(model.get('value'))) {
                    need_fill = true;
                    $(model.get('currentView').$el).addClass('need_fill');
                }
            });

            return need_fill;
        },

        startConsole: function (selectedMethodName, accountCurrent) {
            var selected_method = AMO_API_METHODS[selectedMethodName],
                current_action = selected_method.action,
                current_entity = selected_method.entity,
                current_link = selected_method.link,
                current_fields = selected_method.fields,
                self = this,
                main_select = _.template($('.main-select').html()),
                field_list_view,
                main_select_view,
                custom_fields = current_action === 'list' ? {} : accountCurrent.custom_fields[current_entity];

            self.consoleHelper = ConsoleHelper.setParams(
                this.fieldCollection,
                selectedMethodName,
                accountCurrent
            );
            self.consoleHelper.showCurrentLink();
            self.consoleHelper.renderConsole();

            this.$('.control-menu').removeClass('hide-block');

            if (current_link === 'private/api/v2/json/company/set' || current_link === 'api/v2/companies') {
                custom_fields = accountCurrent.custom_fields.companies;
            }

            this.$('.main_select_block').html(main_select({
                main_fields: current_fields,
                custom_fields: custom_fields
            }));

            field_list_view = new FieldListView({
                model: self.fieldCollection,
                consoleHelper: self.consoleHelper
            });

            main_select_view = new MainSelectView({
                el: $('#main_select_id'),
                selectedMethod: selected_method,
                fieldCollection: self.fieldCollection,
                consoleHelper: self.consoleHelper
            });
            $('#main_select_id').SumoSelect();

            //Вызываем метод который сразу добавит обязательные поля если они есть.
            main_select_view.addRequireFields(current_fields);

            this.$('.generate-button').click(function () {
                var method_type = {},
                    data = self.consoleHelper.generate();

                switch (current_action) {
                    case 'list_unsorted':
                        method_type = 'list_unsorted';
                        break;
                    case 'list':
                        method_type = 'list';
                        break;
                    case 'links':
                        method_type = 'links';
                        break;
                    case 'unsorted_add':
                        method_type = 'unsorted_add';
                        break;
                    default:
                        method_type = 'set';
                }

                ConsoleHelper.copyModalContent('copy-button__php', 'copy-button__json');

                //Если обязательное поле не заполнено, то не пропускаем дальше
                if (self.requireFields()) {
                    return;
                }

                //Не пропускаем дальше, если в неразобранном не добавленна сделка
                if (method_type === 'unsorted_add' && _.isEmpty(data.add[0].incoming_entities)) {
                    self.consoleHelper.renderModal({
                        title: lang('console_need_add_lead'),
                        error: true
                    });

                    return;
                }

                self.consoleHelper.request({
                    json: data,
                    type: method_type,
                    http_headers: self.consoleHelper.getHeaders(),
                    unsorted: self.consoleHelper.unsortedParams,
                    current_account: accountCurrent.subdomain,
                    method_link: self.consoleHelper.generateUrl()
                }).then(function (html) {
                    if (method_type === 'list' || method_type === 'list_unsorted') {
                        self.consoleHelper.renderConsole(JSON.parse(html));
                        self.consoleHelper.dataForCopy = html;
                    } else {
                        self.consoleHelper.renderModal({
                            data: JSON.parse(html),
                            title: false,
                            json: true
                        });
                        self.consoleHelper.dataForCopy = html;
                    }
                }).catch(function (error) {
                    ConsoleHelper.renderModal({
                        title: error.message,
                        status: error.status || null,
                        error: true
                    });
                });
            });

            this.$('#generate_code').click(function () {
                var link,
                    php_code;

                //Если обязательное поле не заполнено, то не пропускаем дальше
                if (self.requireFields()) {
                    return;
                }

                ConsoleHelper.copyModalContent('copy-button__json', 'copy-button__php');

                self.consoleHelper.request({
                    json: self.consoleHelper.generate(),
                    type: 'generate_code',
                    subtype: current_action,
                    http_headers: self.consoleHelper.getHeaders(),
                    unsorted_params: self.consoleHelper.unsortedParams,
                    account_name: self.consoleHelper.accountCurrent.subdomain,
                    full_link: self.consoleHelper.generateUrl()
                }).then(function (json) {
                    if(json.php_code) {
                        link = '<a href="' + lang('console_need_auth_link') + '" target="_blank">' + lang('console_php_modal_title') + "</a>";
                        self.consoleHelper.highlightCode(json.php_code, self.consoleHelper.generateUrl(), current_action);
                    }
                }).catch(function (error) {
                    ConsoleHelper.renderModal({
                        title: error.message,
                        status: error.status || null,
                        error: true
                    });
                });
            });

            //Copy JSON from real js object
            if (!_.isEmpty(self.copyObject)) {
                self.copyObject.destroy();
            }

            self.copyObject = new Clipboard('.copy-links_json', {
                text: function (trigger) {

                    if (self.requireFields()) {
                        return 'empty';
                    }

                    if (current_action === 'list' || current_action === 'list_unsorted') {
                        return self.consoleHelper.dataForCopy;
                    } else {
                        return JSON.stringify(self.consoleHelper.generate());
                    }

                }
            });

            self.copyObject = new Clipboard('.copy-button__json', {
                text: function () {
                    return JSON.stringify(self.consoleHelper.removeAdditionalSymbols(self.consoleHelper.dataForCopy));
                }
            });

            self.copyObject.on('error', function (e) {
                self.consoleHelper.renderModal({
                    title: lang('console_data_large'),
                    error: true
                });
                e.clearSelection();
            });
        }
    });

new ConsoleView();

SelectAccountView = Backbone.View.extend({

    events: {
        'change': 'selectChanged'
    },

    selectChanged: function () {
        var self = this,
            selected_subdomain = this.$(':selected').data('account_subdomain');

        self.trigger('accountSelected', selected_subdomain);

        if (selected_subdomain) {
            $('.account_select_block > label').addClass('label-show');
        }
    },

    render: function (data) {
        var title = '',
            accounts = data._embedded,
            account_select = _.template($('.account-select').html());

        if (!_.isUndefined(accounts) && !_.isUndefined(accounts.items)) {
            title = lang('console_select_account');
            accounts = accounts.items;
        } else {
            title = lang('console_not_auth');
        }

        $('.account_select_block').html(account_select({
            accounts: accounts,
            title: title
        }));
        this.setElement('#account_select_id');
        $('#account_select_id').SumoSelect();
        $('.account_select_block .optWrapper').on('click', function() {
            $('.account_select_block .CaptionCont').css({"margin-left":"62px"});
        })
    }
});


SelectMethodView = Backbone.View.extend({

    accountCurrent: {},
    selectedMethodName: {},
    select_method_field: {},

    events: {
        'change': 'selectChanged',
        'click': 'selectLabel'
    },

    selectChanged: function () {
        this.selectedMethodName = this.$(':selected').data('action_method');
        this.trigger('methodSelected', this.selectedMethodName);

        if (this.selectedMethodName) {
            $('.action_select_block > label').addClass('label-show');
        }
    },

    selectLabel: function() {
        var self = this,
            value_field_now = this.$el.find('option:selected').val(),
            value_field_prev;

        if (_.isEmpty(this.select_method_field)) {
            this.select_method_field.prev = value_field_prev;
            this.select_method_field.now = value_field_now;
        } else {
            this.select_method_field.prev = self.select_method_field.now;
            this.select_method_field.now = value_field_now;
        }

        $('.group > ul li label').each(function () {
            if ($(this).html() === self.select_method_field.prev) {
                $(this).parent().removeClass('selected');
            }

            if ($(this).html() === self.select_method_field.now) {
                $(this).parent().addClass('selected');
            }
        });

    },

    render: function (currentAccount) {
        var selected_methods = _.extend({}, AMO_API_METHODS),
            action_select = _.template($('.action-select').html()),
            title = lang('console_select_method'),
            groups = [];

        delete selected_methods.unsorted_entity_fields;
        this.accountCurrent = currentAccount;

        groups = _.map(selected_methods, function (g) {
            return g.group;
        });

        $('.action_select_block').addClass('opened').html(
            action_select({
                methods: selected_methods,
                title: title,
                groups: groups
            })
        );

        this.setElement('#action_select_id');
        $('#action_select_id').SumoSelect();
        $('.action_select_block .optWrapper').on('click', function() {
            $('.action_select_block .CaptionCont').css({"margin-left":"50px"});
        })
    }
});

Field = Backbone.Model.extend({
    defaults: {
        id: '',
        name: '',
        enums: '',
        values: '',
        value: '',
        field_type: '',
        template_type: ''
    }
});

FieldView = Backbone.View.extend({
    model: new Field(),
    tagName: 'li',
    consoleHelper: {},
    initialize: function (options) {
        this.options = options || {};
        this.consoleHelper = this.options.consoleHelper;
        this.template = options.template;
    },
    events: {
        'change': 'viewChanged',
        'click .delete_field': 'deleteField'
    },

    render: function () {
        var custom_fields ={},
            custom_field_map,
            current_template,
            custom_field,
            catalogs_fields,
            template_data = this.model.toJSON();

        // Создаем связь вьюхи с моделью.
        if (!_.isEmpty(this.model)) {
            this.model.set('currentView', this);
        }

        if (this.model.get('field_type') === 'custom_field') {
            custom_field_map = {
                '1': 'text_type_field',
                '2': 'digit_type_field',
                '3': 'checkbox_type_field',
                '4': 'select_type_field',
                '5': 'multiselect_type_field',
                '6': 'date_type_field',
                '7': 'text_type_field',
                '8': 'enums_type_field',
                '9': 'textarea_type_field',
                '10': 'select_type_field',
                '11': 'streetaddress_type_field',
                '13': 'smart_address_type_field',
                '14': 'birthday_type_field'
            };

            _.each(this.consoleHelper.getAccount('custom_fields'), function (customFieldType) {
                _.each(customFieldType, function (item) {
                    custom_fields[item.id] = item;
                });
            });
        }

        currentModelAttr = this.model.attributes,
            selectTemplate = this.model.get('cf_type') ? custom_field_map[this.model.get('cf_type')] : this.model.get('template_type');

        this.model.set({ template_type: selectTemplate });

        switch (selectTemplate) {
            case 'responsible_user_id_list':
            case 'responsible_user_id':
                template_data = {
                    items: this.consoleHelper.getAccount('users'),
                    field_option: currentModelAttr
                };
                break;
            case 'status_id':
                template_data = {
                    items: this.consoleHelper.getAccount('pipelines'),
                    field_option: currentModelAttr
                };
                break;
            case 'tasks_field_type':
                template_data = {
                    items: this.consoleHelper.getAccount('task_types'),
                    field_option: currentModelAttr
                };
                break;
            case 'notes_field_type':
            case 'notes_unsorted_field_type':
                template_data = {
                    items: this.consoleHelper.getAccount('note_types'),
                    field_option: currentModelAttr
                };
                break;
            case 'select_type_field':
            case 'multiselect_type_field':
            case 'radio_type_field':
            case 'enums_type_field':
                custom_field = custom_fields[this.model.get('id')];
                template_data = {cf: custom_field};
                break;
            case 'widgets_list_select':
                template_data = {
                    items: this.consoleHelper.getAccount('widgets_list'),
                    field_option: currentModelAttr
                };
                break;
            case 'catalogs_list_type_field':
                catalogs_fields = [];
                _.each(this.consoleHelper.getAccount('custom_fields'), function (field, key) {
                    if ($.isNumeric(key)) {
                        catalogs_fields.push(key);
                    }
                });
                template_data = {
                    items: catalogs_fields,
                    field_option: currentModelAttr
                };
                break;

            case 'custom_fields_list_field_type':
                template_data = {
                    items: custom_fields,
                    field_option: currentModelAttr
                };
                break;

            case 'smart_address_type_field':
                custom_field = custom_fields[this.model.get('id')];

                template_data = {
                    cf: custom_field,
                    countries: jsonCountries
                };
                break;
        }
        current_template = _.template($('.' + selectTemplate).html());
        this.$el.html(current_template(template_data));

        return this;
    },

    addNotEmptyClass: function (value) {

        if (!_.isEmpty(value)) {
            if (!this.model.get('require') || this.model.get('template_type') === 'unsorted_lead_name_field' ) {
                this.$el.addClass('field_not_empty');
            }
        } else {
            this.$el.removeClass('field_not_empty');
        }

    },

    controlFieldsForNote: function (value) {
        var types_for_additional_params  = [6, 10, 11],
            call_select_template;

        if (this.model.get('field_type') === 'note_type') {
            if (types_for_additional_params.indexOf(value) !== -1) {
                call_select_template = _.template($('.simple_option_list').html())({
                    fields: AMO_API_METHODS.unsorted_entity_fields.notes
                });
                this.model.trigger('changeCustomFieldsSet', call_select_template);
            } else {
                this.deleteFieldsByEntity('notes');
            }
        }

    },

    viewChanged: function (e) {
        var _this = this,
            value = [],
            current_target = $(e.currentTarget),
            multiple = current_target.find('[multiple]'),
            radio = current_target.find('input[type=radio]:checked'),
            checkbox = current_target.find('input[type=checkbox]'),
            address = current_target.find('#smart_address_wrapper'),
            enums = current_target.find('.enums_wrapper'),
            enums_fields,
            catalogs_fields,
            fields,
            timestamp,
            date,
            address_fields;

        this.$el.removeClass('need_fill');
        current_target.find(':selected').each(function (i, selectedElement) {

            value.push($(selectedElement).data('field_value').toString());

            if (_this.model.get('template_type') === 'status_id') {
                _this.model.set({pipeline_id: $(selectedElement).data('pipeline_id')});
            }

        });

        if (value.length === 1 && multiple.length < 1) {
            value = value[0];
        }

        if (radio.length > 0) {
            value = radio.prop('value');
        }

        if (checkbox.length > 0) {
            this.$el.removeClass('checkbox-checked');
            value = checkbox.prop('checked') ? '1' : '0';

            if (value === '1') {
                this.$el.addClass('checkbox-checked');
            }
        }

        if (enums.length > 0) {
            value = [];
            _.each(enums.children('input'), function (item) {
                if (!$(item).val()) {
                    return;
                }

                enums_fields = {
                    value: $(item).val(),
                    enum: $(item).prop('id')
                };
                value.push(enums_fields);
            });
        }

        if (address.length > 0) {
            value = [];
            _.each(address.children('input'), function (item) {
                if (!$(item).val()) {
                    return;
                }

                address_fields = {
                    value: $(item).val(),
                    subtype: $(item).prop('id')
                };
                value.push(address_fields);
            });

            if (address.find('#country option:selected').data('field_value')) {
                address_fields = {
                    value: address.find('#country option:selected').data('field_value'),
                    subtype: address.find('select').prop('id')
                };
                value.push(address_fields);
                $('#smart_address_wrapper > .SumoSelect').addClass('country-selected');
            }
        }

        if (this.model.get('template_type') === 'date_type_field') {
            date = current_target.find('#' + this.model.get('template_type')).val();
            date = date.substring(0, date.length - 6);
            value = date;
        }

        if (this.model.get('template_type') === 'full_date_type_field') {
            timestamp = current_target.find('#' + this.model.get('template_type')).val();
            value = new Date(timestamp).toString().split(' ');
            value = value[0]+ ' ' + value[2] + ' ' + value[1] + ' ' + value[3] + ' ' + value[4] + ' ' + value[5];
        }

        if (this.model.get('template_type') === 'catalogs_list_type_field' && this.consoleHelper.requestAction !== 'list') {
            _.each(this.consoleHelper.fieldCollection.toJSON(), function (field) {
                if (field.field_type === 'custom_field') {
                    field.currentView.deleteField();
                }
            });
            catalogs_fields = _.template($('.simple_option_list').html())({
                custom_fields: this.consoleHelper.getAccount('custom_fields')[value]
            });
            this.model.trigger('changeCustomFieldsSet', catalogs_fields);
        }

        if (this.model.get('template_type') === 'notes_unsorted_field_type') {
            value = {
                note_type: current_target.find(':selected').data('field_value'),
                element_type: current_target.find('[id="unsorted_entity_digit_type_field"]').val(),
                text: current_target.find('[id="unsorted_note_text_field"]').val(),
                UNIQ: current_target.find('[id="unsorted_note_text_field"]').val(),
            };
        }

        if (this.model.get('template_type') === 'account_type_field') {
            fields = '';

            _.each(value, function (item) {
                fields += item + ',';
            });
            value = fields;
        }

        if (this.model.get('template_type') === 'text_array_type_field') {
            value = current_target.find('#' + this.model.get('template_type')).val().split(',');
        }

        if (this.model.get('template_type') === 'timestamp_type_field') {
            timestamp = current_target.find('#' + this.model.get('template_type')).val();

            value = Date.parse(new Date(timestamp)).toString();
            value = value.substring(0, value.length - 3);
        }

        if (value.length < 1) {
            value = current_target.find('#' + this.model.get('template_type')).val();
            if(_.isEmpty(value)){
                value = [];
            }
        }

        this.addNotEmptyClass(value);
        this.model.set({value: value});

        this.controlFieldsForNote(value);

        this.consoleHelper.generate();
    },

    deleteField: function () {
        this.model.trigger('destroy', this.model, this.model.collection);

        if (!_.isEmpty(this.model.get('entity')) && this.model.get('field_type') === 'name') {
            this.deleteFieldsByEntity(this.model.get('entity'));
        }

        this.el.remove();
        this.consoleHelper.generate();

        if (_.isEmpty(this.model.get('require'))) {
            this.model.trigger('removeFromSelector', this.model.get('id'));
        }
    },

    deleteFieldsByEntity: function (entity) {
        this.model.trigger('removeFromSelector', this.model.get('id'));
        this.model.trigger('removeFromSelectorByEntity', entity);
        _.each(this.consoleHelper.fieldCollection.toJSON(), function (field) {
            if (field.entity === entity) {
                field.currentView.deleteField();
            }
        });


    }
});

FieldListView = Backbone.View.extend({
    model: {},
    el: $('.fields'),
    modelForField: '',
    consoleHelper: {},

    initialize: function (options) {

        this.consoleHelper = options.consoleHelper;
        this.model.off();

        this.listenTo(this.model, 'add', function (e) {
            this.modelForField = e;
            this.render();
        });

        this.listenTo(this.model, 'change', function (e) {
            this.requireFieldLink(e, 'change');
        });

        this.listenTo(this.model, 'remove', function (e) {
            this.requireFieldLink(e, 'remove');
        });

    },
    render: function () {
        var field = (new FieldView({
            model: this.modelForField,
            consoleHelper: this.consoleHelper
        })).render().$el;

        this.$el.find('.main_select_block').before(field);
        this.$('select').SumoSelect();

        if ($(field).find('input').data('field') === 'datetime') {
            $.datetimepicker.setLocale('ru');
            $(field).find('input').datetimepicker({
                dayOfWeekStart: 1,
                className: 'custom--picker'
            });
        }

        return this;
    },

    requireFieldLink: function (element, event) {
        var changed_field = element.toJSON(),
            required_field = {},
            required_field_element = {};

        switch (event) {

            case 'change':
                if (!_.isEmpty(changed_field.required_field)) {
                    required_field = this.getFieldByAttribute('field_type', changed_field.required_field);
                    if (!required_field || _.isEmpty(required_field.get('value'))) {
                        setTimeout(function () {
                            $(changed_field.currentView.el).find('#' + changed_field.template_type + '').prop('disabled', true);
                        }, 100);
                        $.fancybox.open({
                            content: 'Заполните поле ' + changed_field.required_field,
                            wrapCSS: 'console-modal-tooltip'
                        });
                    }
                }

                if (!_.isEmpty(changed_field.link_field)) {
                    required_field = this.getFieldByAttribute('field_type', changed_field.link_field);
                    required_field_element = required_field ? required_field.get('currentView').$el.find('#' + required_field.get('template_type') + '') : required_field;

                    if (!_.isEmpty(changed_field.value) && required_field_element) {
                        required_field_element.removeAttr('disabled');
                        required_field.get('currentView').$el.trigger('change');
                    }

                    if (_.isEmpty(changed_field.value) && required_field_element) {
                        required_field_element.prop('disabled', true);
                        required_field.set({ value: '' });
                    }
                }
                break;

            case 'remove':
                if (!_.isEmpty(changed_field.link_field)) {
                    required_field = this.getFieldByAttribute('field_type', changed_field.link_field);
                    required_field_element = required_field ? required_field.get('currentView').$el.find('#' + required_field.get('template_type') + '') : required_field;

                    if (required_field_element) {
                        required_field_element.prop('disabled', true);
                        required_field.set( {value: ''} );
                    }
                }
                break;
        }
    },

    getFieldByAttribute: function (attr, name) {
        var result = {};

        _.each(this.model.models, function (field) {
            if (field.get(attr) === name) {
                result = field;
            }
        });

        return _.isEmpty(result) ? false : result;
    }
});


//Вьюха Главного селекта
MainSelectView = Backbone.View.extend({
    initialize: function (options) {
        this.selectMethod = options.selectedMethod;
        this.fieldCollection = options.fieldCollection;
        this.consoleHelper = options.consoleHelper;
    },
    selectMethod: {},
    fieldCollection: {},
    consoleHelper: {},
    model: {},
    el: $('#main_select_id'),

    events: {
        'change': 'selectChanged'
    },

    removeFromSelector: function (modelId) {
        this.$el.find('[data-cf_id="' + modelId + '"]').removeClass('hide-select');
        this.$el.SumoSelect();
    },

    removeFromSelectorByEntity: function (entity) {
        var field_class;

        switch (entity) {
            case 'notes':
                field_class = '#main_select_custom_field option';
                break;
            default:
                field_class = '.unsorted-select-' + entity;
        }
        this.$el.find(field_class).remove();
        this.$el.SumoSelect();
    },

    selectChanged: function () {
        var selected_field = this.$(':selected'),
            attributes = {},
            field_type = selected_field.data('field_type'),
            entity = selected_field.data('entity'),
            currentFields;

        if (field_type === 'custom_field') {
            attributes = {
                id: selected_field.data('cf_id'),
                field_type: field_type,
                name: selected_field.val(),
                template_type: selected_field.data('template_type'),
                cf_type: selected_field.data('cf_type_id'),
                entity: entity
            };
        } else {
            currentFields = entity ? AMO_API_METHODS.unsorted_entity_fields[entity] : this.selectMethod.fields;
            _.each(currentFields, function (field) {
                if (field.field_type === field_type) {
                    attributes = field;
                }
            });

            attributes.id = _.isEmpty(attributes.field_id) ? field_type : attributes.field_id;
            attributes.cf_type = selected_field.data('cf_type_id');
        }

        this.model = new Field(attributes);

        //Поля для неразобранного
        if (this.model.get('field_type') === 'unsorted_lead' || this.model.get('field_type') === 'unsorted_contact' || this.model.get('field_type') === 'unsorted_company') {
            this.addFieldForUnsorted(this.model);
        } else {
            this.addField(this.model);
        }

        if (this.model.get('template_type') !== 'multiple_array_type_field') {
            selected_field.addClass('hide-select');
        }

        this.$el.val('select_default');

        $('.main_select_block .CaptionCont span').text('Выберите поле').addClass('placeholder');

        $('#main_select_id').SumoSelect();
    },

    addField: function (model) {
        this.listenTo(model, 'removeFromSelector', this.removeFromSelector);
        this.listenTo(model, 'removeFromSelectorByEntity', this.removeFromSelectorByEntity);
        this.listenTo(model, 'changeCustomFieldsSet', this.changeCustomFieldsSet);
        this.fieldCollection.add(model);
    },

    changeCustomFieldsSet: function (additional_fields) {
        this.$el.find('#main_select_custom_field').html(additional_fields);
        $('#main_select_id').SumoSelect();
    },

    addRequireFields: function (main_fields, allFields) {

        _.each(main_fields, function (main_field) {
            var field_id;

            if (main_field.require === 'Y' || allFields) {
                field_id = _.isEmpty(main_field.field_id) ? main_field.field_type : main_field.field_id;

                this.addField(new Field({
                    field_type: main_field.field_type,
                    id: field_id,
                    name: main_field.name,
                    template_type: main_field.template_type,
                    require: main_field.require,
                    entity: main_field.entity
                }));
            }
        }, this);
    },

    addFieldForUnsorted: function () {
        var unsorted_select_template = _.template($('.unsorted-select').html()),
            current_custom_fields = this.consoleHelper.accountCurrent.custom_fields[this.model.get('entity')],
            custom_fields_entity = [];

        _.each(current_custom_fields, function (custom_field) {
            var tmp_field = custom_field;

            tmp_field.entity = this.model.get('entity');
            custom_fields_entity.push(tmp_field);
        }, this);
        unsorted_select_template = unsorted_select_template({
            main_fields: AMO_API_METHODS.unsorted_entity_fields[this.model.get('entity')],
            custom_fields: custom_fields_entity,
            entity: this.model.get('entity')
        });

        if(!this.$el.find('option').hasClass('unsorted-select-' + this.model.get('entity'))){
            this.$el.append(unsorted_select_template);
        }

        this.addRequireFields(AMO_API_METHODS.unsorted_entity_fields[this.model.get('entity')]);
    }

});

ConsoleHelper = {

    fieldCollection: {},
    requestEntity: {},
    requestAction: {},
    accountCurrent: {},
    unsortedParams: {},
    dataForCopy: {},

    setParams: function (fieldCollection, currentMethod, currentAccount) {
        this.fieldCollection = fieldCollection;
        this.requestEntity = AMO_API_METHODS[currentMethod].entity;
        this.requestAction = AMO_API_METHODS[currentMethod].action;
        this.accountCurrent = currentAccount;
        this.selectedAccount = this.accountCurrent.subdomain;
        this.method = AMO_API_METHODS[currentMethod];

        return this;
    },

    request: function (params) {

        return new Promise(function (resolve, rejected) {
            $.ajax({
                url: 'console.php',
                data: params,
                method: 'post',
                success: function (data) {
                    resolve(data)
                },
                error: function (error) {
                    rejected({
                        message: error.responseText,
                        status: error.status
                    });
                }
            });
        });
    },

    generate: function () {

        switch (this.requestAction) {
            case 'add':
            case 'update':
            case 'delete':
            case 'subscribe':
            case 'unsubscribe':
            case 'link':
            case 'unlink':
            case 'install':

                return this.methodSet();
                break;
            case 'list':
            case 'list_unsorted':
            case 'links':

                return this.methodList();
                break;
            case 'delete_array':
            case 'accept':
            case 'decline':

                return this.methodDelete();
                break;
            case 'unsorted_add':

                return this.methodUnsortedAdd();
                break;
        }
    },

    showCurrentLink: function (params) {
        var get_params = params ? '?' + params : '',
            link = this.generateUrl() + get_params,
            display_link = this.currentHttpMethod() + ' <span id="url">' + link + '</span>';

        $('.url-display').html(display_link);
        $('.copy-button').show().attr('data-copied', 'Скопировано').click(function() {
            $(this).addClass('js-copied');
            _.delay(_.bind(function(){
                $(this).removeClass('js-copied');
            }, this), 800);
        });

        return link;
    },

    currentHttpMethod: function () {
        var http_method;

        switch (this.requestAction) {
            case 'list':
            case 'list_unsorted':
            case 'links':
                http_method = 'GET';
                break;
            default:
                http_method = 'POST';
        }

        return http_method;
    },

    generateUrl: function () {
        var url = this.getBaseUrl() + this.method.link;

        return url;
    },

    hideCurrentLink: function () {
        $('.url-display').html('');
        $('.icon-button').hide();
    },

    getBaseUrl: function (subdomain) {
        var hostname = location.host,
            split_url = hostname.split('.'),
            top_level_domain = split_url.pop(),
            protocol,
            link;

        if (top_level_domain === 'saas') {
            link = '.' + split_url[split_url.length - 2] + '.amocrm2.' + top_level_domain + '/';
            protocol = 'http://';
        } else {
            link = '.amocrm.' + top_level_domain + '/';
            protocol = 'https://';
        }

        subdomain = subdomain ? subdomain : this.selectedAccount;

        return protocol + subdomain + link;
    },

    methodList: function () {
        var all_enabled_fields = this.fieldCollection.toJSON(),
            params = '';

        _.each(all_enabled_fields, function (field) {

            if(!_.isUndefined(field.header)){
                return;
            }

            if (field.template_type === 'date_type_field') {
                var my_date = field.value.split('/');
                my_date = my_date[1] + "/" + my_date[2] + "/" + my_date[0];
                params += encodeURI(field.field_type + '=' + my_date + '&');

                return;
            }

            if (_.isArray(field.value)) {
                _.each(field.value, function (item) {
                    params += field.field_type + '=' + item + '&';
                });

                return;
            }

            if (field.value.length > 0) {
                if (field.value.indexOf(',') !== -1 && field.data_type !== 'comma') {
                    _.each(field.value.split(','), function (item) {
                        params += [field.field_type] + '[]=' + item + '&';
                    });
                } else {
                    params += field.field_type + '=' + field.value + '&';
                }
            }

        });

        //Убираем в конце GET запроса лишние символы
        if (params.substring(params.length - 2) === ',&') {
            params = params.substring(0, params.length - 2);
        } else {
            if (params.substring(params.length - 1) === '&') {
                params = params.substring(0, params.length - 1);
            }
        }

        return this.showCurrentLink(encodeURI(params));
    },

    renderConsole: function (data) {
        var json_renderer = $('#json-renderer');

        json_renderer.jsonViewer(data);
    },

    getHeaders: function () {
        var all_enabled_fields = this.fieldCollection.toJSON(),
            headers = [];

        _.each(all_enabled_fields, function (field) {
            if (!_.isUndefined(field.header)) {
                headers.push({header: field.field_type, value: field.value});
            }
        });

        return headers;
    },

    methodSet: function () {

        var all_enabled_fields = this.fieldCollection.toJSON(),
            query = JSON.parse('{"' + this.requestAction + '":{}}'),
            element = {},
            multiple_array = [],
            custom_fields = [],
            additional_params = {};

        _.each(all_enabled_fields, function (field) {
            var cf = {},
                key;

            if (field.field_type === 'custom_field') {
                cf.id = field.id;
                cf.values = [{value: field.value}];

                if (_.isArray(field.value) && field.value.length > 0) {
                    cf.values = field.value;
                }

                if (field.value.length > 0) {
                    custom_fields.push(cf);
                }
            } else {
                if (field.value.length > 0) {
                    if (field.template_type === 'multiple_array_type_field') {
                        multiple_array.push(field.value);
                        element[field.field_type] = multiple_array;
                    } else {
                        if (!_.isUndefined(field.additional_params)) {
                            key = _.isUndefined(field.additional_key)? field.field_type : field.additional_key;

                            if (_.isUndefined(additional_params[field.additional_params])) {
                                additional_params[field.additional_params] = {};
                            }

                            if (_.isUndefined(additional_params[field.additional_params][key])) {
                                additional_params[field.additional_params][key] = {};
                            }
                            additional_params[field.additional_params][key] = field.value;
                        } else {
                            element[field.field_type] = field.value;
                        }
                    }
                    if (field.field_type === 'status_id' && (field.value === '142' || field.value === '143')) {
                        element.pipeline_id = field.pipeline_id;
                    }
                }
            }
        });

        if (!_.isEmpty(additional_params)) {
            _.each(additional_params, function (value, key) {
                element[key] = value;
            });
        }

        if (custom_fields.length > 0) {
            element.custom_fields = custom_fields;
        }

        query[this.requestAction] = [element];
        this.renderConsole();

        if (query[this.requestAction].length > 0 && this.fieldCollection.length > 0) {
            this.renderConsole(query);
        }

        return query;
    },

    methodUnsortedAdd: function () {

        var all_enabled_fields = this.fieldCollection.toJSON(),
            query = JSON.parse('{"add":{}}'),
            self = this,
            element = {},
            incoming_entities = {},
            notesCall = [],
            data = {},
            params = '',
            multiple_array = [];
        element.leads = {},
            element.contacts = {},
            element.companies = {},
            element.settings = {},
            element.main_field = {},
            element.origin = {},
            element.from = {},
            element.source_data = {};

        _.each(all_enabled_fields, function (field) {
            var cf,
                entityForNote;

            if (field.field_type === 'custom_field') {
                if (_.isEmpty(element[field.entity].custom_fields)) {
                    element[field.entity].custom_fields = [];
                }
                cf = {};

                cf.id = field.id;
                cf.values = [{value: field.value}];

                if (_.isArray(field.value) && field.value.length > 0) {
                    cf.values = field.value;
                }

                if (field.value.length > 0) {
                    element[field.entity].custom_fields.push(cf);
                }
            } else {
                if (field.value.length > 0) {
                    if (field.template_type === 'multiple_array_type_field') {
                        multiple_array.push(field.value);
                        element[field.entity][field.field_type] = multiple_array;
                    } else {
                        element[field.entity][field.field_type] = field.value;
                    }
                    if (field.field_type === 'status_id' && (field.value === '142' || field.value === '143')) {
                        element[field.entity].pipeline_id = field.pipeline_id;
                    }
                }
            }

            if (field.field_type === 'notes') {
                entityForNote = '';

                element[field.entity].notes = [{
                    note_type: field.value.note_type,
                    element_type: {},
                    text: field.value.text
                }];
                switch (field.entity) {
                    case 'leads':
                        entityForNote = 'lead';
                        break;
                    case 'contacts':
                        entityForNote = 'contact';
                        break;
                    case 'companies':
                        entityForNote = 'company';
                        break;
                }
                element[field.entity].notes[0].element_type = entityForNote;

                if (self.method.unsorted_category === 'sip' && ['6', '10', '11'].indexOf(field.value.note_type) !== -1) {
                    notesCall.push(field);
                }
            }
        });

        if (!_.isEmpty(notesCall)) {
            _.each(notesCall, function (field) {
                element[field.entity].notes[0].text = {
                    UNIQ: field.value.UNIQ,
                    LINK: element.source_data.link,
                    PHONE: element.source_data.from,
                    DURATION: element.source_data.duration,
                    SRC: element.source_data.service
                };
            });
        }

        if (!_.isEmpty(element.settings)) {
            _.each(element.settings, function (i, k) {
                params += k + '=' + i + '&';
            });
            this.showCurrentLink(params);
            this.unsortedParams = '?' + params;
        } else {
            this.unsortedParams = null;
        }

        if (!_.isEmpty(element.leads)) {
            incoming_entities.leads = [element.leads];
        }

        if (!_.isEmpty(element.contacts)) {
            incoming_entities.contacts = [element.contacts];
        }

        if (!_.isEmpty(element.companies)) {
            incoming_entities.companies = [element.companies];
        }

        data = element.main_field;

        if (!_.isEmpty(incoming_entities)) {
            data.incoming_entities = incoming_entities;
        }

        if (!_.isEmpty(element.source_data)) {
            data.incoming_lead_info = element.source_data;
        }

        query.add = [data];
        this.renderConsole();

        if (query.add.length > 0 && this.fieldCollection.length > 0) {
            this.renderConsole(query);
        }

        return query;
    },

    methodDelete: function () {
        var current_action = this.requestAction,
            settings = [],
            all_enabled_fields,
            params = '';

        if (this.requestAction === 'delete_array') {
            current_action = 'delete';
        }

        all_enabled_fields = this.fieldCollection.toJSON(),
            query = JSON.parse('{"' + current_action + '":{}}'),
            value = {};

        _.each(all_enabled_fields, function (field) {
            if (field.entity === 'settings' && field.value.length > 0) {
                settings.push(field);

                return;
            }

            if (field.value.length > 0) {
                query[field.field_type] = field.value;
            }
        }, this);

        if (settings.length > 0) {
            _.each(settings, function (i) {
                params += i.field_type + '=' + i.value + '&';
            });
            this.unsortedParams = '?' + params;
        } else {
            this.unsortedParams = null;
        }

        this.showCurrentLink(params);
        this.renderConsole();

        if (this.fieldCollection.length > 0) {
            this.renderConsole(query);
        }

        return query;
    },

    getAccount: function (data) {

        return _.isEmpty(data) ? this.accountCurrent : this.accountCurrent[data];
    },

    highlightCode: function (body, link, action) {
        var code = '<pre><code>',
            headers = this.getHeaders();

        if (action === 'unsorted_add' || action === 'list_unsorted' || action === 'accept' || action === 'decline') {
            link = link + this.unsortedParams;
        }

        if (action === 'list' || action === 'list_unsorted') {
            code += '$link = ' + body + ';\n\n';
        } else {
            code += '$data = ' + body + ';\n'+
                '$link = "' + link + '";\n\n';
        }

        if(!_.isEmpty(headers)){
            _.each(headers, function (item) {
                code += '$headers[] = "' + item.header + ': ' + item.value + '";\n';
            });
        }

        code += '$headers[] = "Accept: application/json";\n';
        code += '\n //Curl options\n'+
            '$curl = curl_init();\n'+
            'curl_setopt($curl, CURLOPT_RETURNTRANSFER,true);\n'+
            'curl_setopt($curl, CURLOPT_USERAGENT, "amoCRM-API-client-\n' + this.accountCurrent.subdomain + '/2.0");\n'+
            'curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);\n';

        if (action !== 'list' && action !== 'list_unsorted') {
            code += 'curl_setopt($curl, CURLOPT_POSTFIELDS, http_build_query($data));\n';
        }

        code += 'curl_setopt($curl, CURLOPT_URL, $link);\n'+
            'curl_setopt($curl, CURLOPT_HEADER,false);\n';

        if (action !== 'unsorted_add' && action !== 'list_unsorted' && action !== 'accept' && action !== 'decline') {
            code += 'curl_setopt($curl,CURLOPT_COOKIEFILE,dirname(__FILE__)."/cookie.txt");\n'+
                'curl_setopt($curl,CURLOPT_COOKIEJAR,dirname(__FILE__)."/cookie.txt");\n';
        }

        code += '$out = curl_exec($curl);\n'+
            'curl_close($curl);\n'+
            '$result = json_decode($out,TRUE);\n' +
            '</pre></code>';
        this.renderModal({
            data: code,
            title: link
        });
    },

    renderModal: function (params) {
        var modal,
            modal_request,
            http_method,
            current_method_api,
            request_url,
            modal_params = {};

        if (!_.isUndefined(params.error)) {
            modal = $('#error-modal');
            title = params.title || lang('console_common_error');
            modal.find('.modal-body__caption-error').text(title);
            modal_params = {
                href: modal.selector,
                wrapCSS: 'console-modal-error'
            };
            if (!_.isUndefined(params.status) && params.status === 403) {
                _.extend(modal_params, {
                    afterClose : function() {
                        location.reload();
                        return;
                    }
                });
            }
        } else {
            modal = $('#console-modal');
            modal_request = modal.find('.log-info__full-request');
            http_method = this.currentHttpMethod();
            current_method_api = this.method;
            request_url = this.generateUrl();

            if (modal_request.hasClass('json-code')) {
                modal_request.removeClass('json-code');
            }

            if (params.json) {
                modal_request.jsonViewer(params.data);
                modal_request.addClass('json-code');
            } else if(!_.isEmpty(params.data)) {
                modal_request.html(params.data);
            }

            $('pre code').each(function (i, block) {
                hljs.highlightBlock(block);
            });

            modal.find('.console-modal__description_method').text(http_method + ' ' + current_method_api.link);
            modal.find('.console-modal__description_url').text(request_url);

            modal_params = {
                href: modal.selector
            };
        }

        $.fancybox(modal_params);
    },

    removeAdditionalSymbols: function () {
        return JSON.parse(this.dataForCopy);
    },

    copyModalContent: function (remove, add) {
        $('#console-modal').find('.copy-button__modal').removeClass(remove).addClass(add);
    }


};
