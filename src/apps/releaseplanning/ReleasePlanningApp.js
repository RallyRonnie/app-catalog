(function() {
    var Ext = window.Ext4 || window.Ext;

    Ext.define('Rally.apps.PIplanning.PIPlanningApp', {
        extend: 'Rally.app.App',
        requires: [
            'Rally.data.util.PortfolioItemHelper',
            'Rally.ui.gridboard.planning.TimeboxGridBoard',
            'Rally.ui.gridboard.plugin.GridBoardAddNew',
            'Rally.ui.gridboard.plugin.GridBoardFieldPicker',
            'Rally.ui.gridboard.plugin.GridBoardCustomFilterControl',
            'Rally.ui.gridboard.plugin.GridBoardInlineFilterControl',
            'Rally.ui.gridboard.plugin.GridBoardSharedViewControl'
        ],

        launch: function() {
            Rally.data.util.PortfolioItemHelper.loadTypeOrDefault({
                defaultToLowest: true,
                requester: this,
                success: function (piTypeDef) {
                    this.piTypePath = piTypeDef.get('TypePath');
                    this._buildGridBoard();
                },
                scope: this
            });
        },

        _buildGridBoard: function () {
            app = this;
            var context = this.getContext();

            this.gridboard = this.add({
                xtype: 'rallytimeboxgridboard',
                numColumns: this.getSetting('numColumns'),
                cardBoardConfig: {
                    columnConfig: {
                        columnStatusConfig: {
                            pointField: this.getSetting('pointField')
                        },
                        fields: this._getDefaultFields()
                    },
                    storeConfig: {
                        filters: this.getQueryFilter()
                    },
                    listeners: {
                        filter: this._onBoardFilter,
                        filtercomplete: this._onBoardFilterComplete,
                        scope: this
                    },
                    rowConfig: {
                        field: this.getSetting('Swimlane'),
                        sortDirection: 'ASC',
                        enableCrossRowDragging: false
                    }
                },
                context: context,
                endDateField: 'ReleaseDate',
                listeners: {
                    load: this._onLoad,
                    toggle: this._publishContentUpdated,
                    recordupdate: this._publishContentUpdatedNoDashboardLayout,
                    recordcreate: this._publishContentUpdatedNoDashboardLayout,
                    preferencesaved: this._publishPreferenceSaved,
                    viewchange: this._viewChange,
                    scope: this
                },
                modelNames: this._getModelNames(),
                plugins: this._getPlugins(),
                startDateField: 'ReleaseStartDate',
                timeboxType: 'Release'
            });
        },

        _getPlugins: function () {
            var context = this.getContext(),
                boardFieldBlacklist = [
                    'AcceptedLeafStoryCount',
                    'AcceptedLeafStoryPlanEstimateTotal',
                    'DirectChildrenCount',
                    'LeafStoryCount',
                    'LeafStoryPlanEstimateTotal',
                    'LastUpdateDate',
                    'UnEstimatedLeafStoryCount'
                ];

            var plugins = [
                {
                    ptype: 'rallygridboardaddnew',
                    rankScope: 'BACKLOG',
                    addNewControlConfig: {
                        stateful: true,
                        stateId: context.getScopedStateId('release-planning-add-new')
                    }
                },
                this._getCustomFilterControlPluginConfig(),
                {
                    ptype: 'rallygridboardfieldpicker',
                    boardFieldBlackList: boardFieldBlacklist,
                    headerPosition: 'left'
                }
            ];
            if (context.isFeatureEnabled('F8943_UPGRADE_TO_NEWEST_FILTERING_SHARED_VIEWS_ON_MANY_PAGES')) {
                plugins.push(this._getSharedViewPluginConfig());
            }
            return plugins;

        },

        _getCustomFilterControlPluginConfig: function() {
            var context = this.getContext();
            var blackListFields = ['PortfolioItemType', 'Release', 'ModelType'];
            var whiteListFields = ['Milestones', 'Tags'];

            if (context.isFeatureEnabled('F8943_UPGRADE_TO_NEWEST_FILTERING_SHARED_VIEWS_ON_MANY_PAGES')) {
                return {
                    ptype: 'rallygridboardinlinefiltercontrol',
                    inlineFilterButtonConfig: {
                        stateful: true,
                        stateId: context.getScopedStateId('release-planning-inline-filter'),
                        legacyStateIds: [
                            context.getScopedStateId('release-planning-owner-filter'),
                            context.getScopedStateId('release-planning-custom-filter-button')
                        ],
                        filterChildren: false,
                        modelNames: this._getModelNames(),
                        inlineFilterPanelConfig: {
                            quickFilterPanelConfig: {
                                defaultFields: [
                                    'ArtifactSearch',
                                    'Owner',
                                    'Parent'
                                ],
                                addQuickFilterConfig: {
                                    blackListFields: blackListFields,
                                    whiteListFields: whiteListFields
                                }
                            },
                            advancedFilterPanelConfig: {
                                advancedFilterRowsConfig: {
                                    propertyFieldConfig: {
                                        blackListFields: blackListFields,
                                        whiteListFields: whiteListFields
                                    }
                                }
                            }
                        }
                    }
                };
            }

            return {
                ptype: 'rallygridboardcustomfiltercontrol',
                filterChildren: false,
                filterControlConfig: {
                    margin: '3 9 3 30',
                    blackListFields: ['PortfolioItemType', 'Release'],
                    whiteListFields: ['Milestones'],
                    modelNames: this._getModelNames(),
                    stateful: true,
                    stateId: context.getScopedStateId('release-planning-custom-filter-button')
                },
                showOwnerFilter: true,
                ownerFilterControlConfig: {
                    stateful: true,
                    stateId: context.getScopedStateId('release-planning-owner-filter')
                }
            };
        },

        _getSharedViewPluginConfig: function () {
            var context = this.getContext();

            return {
                ptype: 'rallygridboardsharedviewcontrol',
                sharedViewConfig: {
                    stateful: true,
                    stateId: context.getScopedStateId('release-planning-shared-view'),
                    defaultViews: _.map(this._getDefaultViews(), function(view) {
                        Ext.apply(view, {
                            Value: Ext.JSON.encode(view.Value, true)
                        });
                        return view;
                    }, this),
                    enableUrlSharing: this.isFullPageApp !== false
                }
            };
        },

        _getDefaultViews: function() {
            return [
                {
                    Name: 'Default View',
                    identifier: 1,
                    Value: {
                        toggleState: 'board',
                        fields: this._getDefaultFields()
                    }
                }
            ];
        },

        _onLoad: function() {
            this._publishContentUpdated();
            this.recordComponentReady();
            if (Rally.BrowserTest) {
                Rally.BrowserTest.publishComponentReady(this);
            }
        },

        _onBoardFilter: function() {
            this.setLoading(true);
        },

        _onBoardFilterComplete: function() {
            this.setLoading(false);
        },

        _publishContentUpdated: function() {
            this.fireEvent('contentupdated');
        },

        _publishContentUpdatedNoDashboardLayout: function() {
            this.fireEvent('contentupdated', {dashboardLayout: false});
        },

        _publishPreferenceSaved: function(record) {
            this.fireEvent('preferencesaved', record);
        },

        _getDefaultFields: function() {
            return ['Discussion', 'PreliminaryEstimate', 'UserStories', 'Milestones'];
        },

        _getModelNames: function() {
            return [this.piTypePath];
        },

        _viewChange: function() {
            if (this.gridboard) {
                this.gridboard.destroy();
            }
            this._buildGridBoard();
        },
        getSettingsFields: function () {
            var values = [
                {
                    name: 'numColumns',
                    xtype: 'rallynumberfield',
                    label: 'Columns:',
                    margin: '0 0 0 0'
                },
                {
                    xtype: 'label',
                    forId: 'myFieldId1',
                    text: 'Estimate Field:',
                    margin: '0 0 0 0'
                },
                {
                    xtype: 'rallyradiofield',
                    fieldLabel: 'Preliminary Estimate',
                    margin: '0 0 0 20',
                    name: 'pointField',
                    inputValue: 'PreliminaryEstimateValue'
                },
                {
                    xtype: 'rallyradiofield',
                    fieldLabel: 'Refined Estimate',
                    margin: '0 0 0 20',
                    name: 'pointField',
                    inputValue: 'RefinedEstimate'
                },
                {
                    xtype: 'rallyradiofield',
                    fieldLabel: 'Story Plan Estimate',
                    margin: '0 0 15 20',
                    name: 'pointField',
                    inputValue: 'LeafStoryPlanEstimateTotal'
                },
                {
                    xtype: 'label',
                    forId: 'myFieldId2',
                    text: 'Swimlanes:',
                    margin: '0 0 0 0'
                },
                {
                    xtype: 'rallyradiofield',
                    margin: '0 0 0 20',
                    fieldLabel: 'None',
                    name: 'Swimlane',
                    inputValue: ''
                },                {
                    xtype: 'rallyradiofield',
                    fieldLabel: 'Parent',
                    margin: '0 0 0 20',
                    name: 'Swimlane',
                    inputValue: 'Parent'
                },
                {
                    xtype: 'rallyradiofield',
                    fieldLabel: 'Team',
                    margin: '0 0 0 20',
                    name: 'Swimlane',
                    inputValue: 'Project'
                },
                {
                    xtype: 'rallyradiofield',
                    fieldLabel: 'State',
                    margin: '0 0 15 20',
                    name: 'Swimlane',
                    inputValue: 'State'
                },
                {
                    type: 'query'
                }
            ];
            return values;
        },
        config: {
            defaultSettings: {
                Swimlane: '',
                numColumns: 4,
                pointField: 'PreliminaryEstimateValue',
                query: ''
            }
        },
        getQueryFilter: function () {
            var queries = [];
            if (app.getSetting('query')) {
                queries.push(Rally.data.QueryFilter.fromQueryString(app.getSetting('query')));
            }
            return queries;
        }    
    });
})();
