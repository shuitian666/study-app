/**
 * 同步注册表 - 模块级单例，用于跨 Context 同步
 *
 * 提供一种方式让 LearningContext 能够通知 AppContext 学习状态的变化，
 * 而不会创建循环依赖。
 */

import type { Dispatch } from 'react';
import type { Action } from './AppContext';

let appDispatchRef: Dispatch<Action> | null = null;

/**
 * 注册 AppContext 的 dispatch 函数
 * 由 AppProvider 在初始化时调用
 */
export function registerAppDispatch(dispatch: Dispatch<Action>): void {
  appDispatchRef = dispatch;
}

/**
 * 获取已注册的 AppContext dispatch 函数
 * 由 LearningContext 在需要同步状态时调用
 */
export function getAppDispatch(): Dispatch<Action> | null {
  return appDispatchRef;
}
