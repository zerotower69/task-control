//子任务
export interface SubTask {
    //任务id,不指定将自动从1生成
    id?: number
    //任务本身
    task: (...args: any[]) => Promise<any>
    //任务排序
    order?: number
    //执行当前任务后等待多长时间
    wait?: number;
    //销毁哪些id结果
    clear?:number|Array<number>
}
export interface UseSuperTaskOptions {
    /**
     * 任务队列每次开始执行前的回调
     */
    beforeFn?:()=>void;
    /**
     * 任务队列执行结束后执行的回调
     */
    afterFn?:()=>void;
    /**
     * 每个任务执行前执行的回调
     * @param taskId 任务id
     */
    eachBeforeFn?:(taskId:number)=>void;
    /**
     * 每个任务执行后执行的回调
     * @param taskId 任务id
     * @param result 每个任务执行后的返回值
     */
    eachAfterFn?:(taskId:number,result:any)=>void;
    /**
     * destroy调用前执行
     */
    beforeDestroy?:()=>void;
    /**
     * destroy调用后执行
     */
    afterDestroyed?:()=>void;
    /**
     * 任务队列状态发生变更时执行
     * @param status 任务队列状态
     */
    onStatusChange?:(status:TaskStatus,oldStatus:TaskStatus)=>void,
    /**
     * 是否立刻执行任务队列，默认false
     */
    immediate?:boolean;
}

export interface UseSuperTaskReturn {
    /**
     * 暂停任务队列的执行
     */
    pause: () => void
    /**
     * 恢复任务队列的执行
     */
    resume: () => void
    /**
     * 销毁任务队列执行返回的结果
     * @param results 每个任务返回的结果，有序
     */
    destroy: () => void
    /**
     * 重启任务队列
     * @param timeout 延时多久重启，默认0
     */
    restart:(timeout?:number)=>void;
    /**
     * 更新任务队列，仅在任务队列执行前、玩成和销毁后生效
     * @param tasks 任务队列
     * @param run 是否立刻执行，默认false
     */
    update:(tasks:SubTask[],run?:boolean)=>void
}

//task status type
export enum TaskStatus {
    READY='ready' ,
    PENDING ='pending',
    EXECUTING  ='executing',
    FINISHED ='finished',
    DESTROYED ='destroyed'
}