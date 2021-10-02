import {
    Component,
    component,
    ComponentContainer,
    ComponentType, currentComponentContainerAction,
    Dependency,
    DependencyStorage,
    getDefaultScope,
    IConstructable, Scope,
    ScopeImpl,
    ScopeType
} from "./internals";

@component(ComponentType.Singleton)
export class Container {
    protected readonly storage: DependencyStorage = new DependencyStorage();
    protected readonly parent: Container|null;
    protected readonly scope: ScopeImpl;
    protected readonly children: Container[] = [];

    constructor(parent: Container|null = null, scope: ScopeImpl|null = null) {
        this.parent = parent;
        this.scope = scope ? scope : getDefaultScope() as ScopeImpl;
    }

    init() {
        this.storage.saveInstance(Component.create<Container>(Container), this);
    }

    public getBean<T>(dependency: Dependency<T>): T {
        return this.getComponentInstance(Component.create(dependency));
    }

    public getComponent(component: Component): Component {
        return component.getComponent();
    }

    public getComponentInstance<T>(component: Component<T>): T {
        component = this.getComponent(component);
        const instance = this.storage.getInstance(component);

        if (instance === undefined) {
            if (component.getScope() === this.getScope() || component.isApplicationContext()) {
                if (!component.isConstructable()) {
                    throw new Error("I can't instantiate a " + component.name + " that is not a component.");
                }
                const type = component.getType();
                const componentContainer = new ComponentContainer(this);
                const instance = this.buildNewInstance(component, componentContainer);
                if (type === ComponentType.Singleton) {
                    this.storage.saveInstance(component, instance);
                }
                this.runPostConstruct(instance, component, componentContainer);
                return instance;
            } else {
                return this.getContainerForComponent(component).getComponentInstance(component);
            }
        }

        return instance as T;
    }

    protected getContainerForComponent(component: Component): Container {
        const scope = component.getScope();
        const commonScope = ScopeImpl.getCommonParent(scope, this.getScope());
        const commonContainer = this.getParentContainerByScope(commonScope);

        if (commonContainer === undefined) {
            throw new Error("");
        }

        return commonContainer.getOrCreateContainerForScope(scope, component);
    }

    public getParentContainerByScope(scope: Scope): Container|undefined {
        if (this.getScope() === scope) {
            return this;
        }
        const parent = this.parent;

        if (parent === null) {
            return undefined;
        }

        return parent.getParentContainerByScope(scope);
    }

    private getOrCreateContainerForScope(scope: ScopeImpl, component: Component): Container {
        if (scope === this.getScope()) {
            return this;
        }
        const childScope = this.getScope().getDirectChildFor(scope);
        const scopeId = childScope.getId();
        const container = this.children[scopeId] ?? this.createContainer(childScope);

        return container.getOrCreateContainerForScope(scope, component);
    }

    private createContainer(scope: ScopeImpl): Container {
        const container = new Container(this, scope);
        const scopeId = scope.getId();
        if (scope.getType() === ScopeType.Singleton) {
            this.children[scopeId] = container;
        }
        container.init();

        return container;
    }

    protected buildNewInstance<T>(component: IConstructable<T>, componentContainer: ComponentContainer): T {
        return currentComponentContainerAction(componentContainer, () => {
            return component.construct(componentContainer)
        });
    }

    protected runPostConstruct(instance: any, component: Component, componentContainer: ComponentContainer) {
        component.postConstruct(componentContainer, instance);
    }

    protected getScope(): ScopeImpl {
        return this.scope;
    }

    public countOfDependencies(): number {
        return this.storage.countOfDependencies();
    }
}

export const ContainerComponent = Component.create(Container);