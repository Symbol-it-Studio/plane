import React, { useCallback, useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/router";

import { mutate } from "swr";

// react-beautiful-dnd
import {
  DraggableProvided,
  DraggableStateSnapshot,
  DraggingStyle,
  NotDraggingStyle,
} from "react-beautiful-dnd";
// services
import issuesService from "services/issues.service";
// hooks
import useToast from "hooks/use-toast";
// components
import {
  ViewAssigneeSelect,
  ViewDueDateSelect,
  ViewPrioritySelect,
  ViewStateSelect,
} from "components/issues/view-select";
// ui
import { ContextMenu, CustomMenu, Tooltip } from "components/ui";
// icons
import {
  ClipboardDocumentCheckIcon,
  LinkIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
// helpers
import { copyTextToClipboard, truncateText } from "helpers/string.helper";
// types
import {
  CycleIssueResponse,
  IIssue,
  ModuleIssueResponse,
  NestedKeyOf,
  Properties,
  UserAuth,
} from "types";
// fetch-keys
import { CYCLE_ISSUES, MODULE_ISSUES, PROJECT_ISSUES_LIST } from "constants/fetch-keys";

type Props = {
  type?: string;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  issue: IIssue;
  selectedGroup: NestedKeyOf<IIssue> | null;
  properties: Properties;
  editIssue: () => void;
  makeIssueCopy: () => void;
  removeIssue?: (() => void) | null;
  handleDeleteIssue: (issue: IIssue) => void;
  orderBy: NestedKeyOf<IIssue> | null;
  handleTrashBox: (isDragging: boolean) => void;
  userAuth: UserAuth;
};

export const SingleBoardIssue: React.FC<Props> = ({
  type,
  provided,
  snapshot,
  issue,
  selectedGroup,
  properties,
  editIssue,
  makeIssueCopy,
  removeIssue,
  handleDeleteIssue,
  orderBy,
  handleTrashBox,
  userAuth,
}) => {
  // context menu
  const [contextMenu, setContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  const router = useRouter();
  const { workspaceSlug, projectId, cycleId, moduleId } = router.query;

  const { setToastAlert } = useToast();

  const partialUpdateIssue = useCallback(
    (formData: Partial<IIssue>) => {
      if (!workspaceSlug || !projectId) return;

      if (cycleId)
        mutate<CycleIssueResponse[]>(
          CYCLE_ISSUES(cycleId as string),
          (prevData) => {
            const updatedIssues = (prevData ?? []).map((p) => {
              if (p.issue_detail.id === issue.id) {
                return {
                  ...p,
                  issue_detail: {
                    ...p.issue_detail,
                    ...formData,
                    assignees: formData.assignees_list ?? p.issue_detail.assignees_list,
                  },
                };
              }
              return p;
            });
            return [...updatedIssues];
          },
          false
        );

      if (moduleId)
        mutate<ModuleIssueResponse[]>(
          MODULE_ISSUES(moduleId as string),
          (prevData) => {
            const updatedIssues = (prevData ?? []).map((p) => {
              if (p.issue_detail.id === issue.id) {
                return {
                  ...p,
                  issue_detail: {
                    ...p.issue_detail,
                    ...formData,
                    assignees: formData.assignees_list ?? p.issue_detail.assignees_list,
                  },
                };
              }
              return p;
            });
            return [...updatedIssues];
          },
          false
        );

      mutate<IIssue[]>(
        PROJECT_ISSUES_LIST(workspaceSlug as string, projectId as string),
        (prevData) =>
          (prevData ?? []).map((p) => {
            if (p.id === issue.id)
              return { ...p, ...formData, assignees: formData.assignees_list ?? p.assignees_list };

            return p;
          }),

        false
      );

      issuesService
        .patchIssue(workspaceSlug as string, projectId as string, issue.id, formData)
        .then((res) => {
          if (cycleId) mutate(CYCLE_ISSUES(cycleId as string));
          if (moduleId) mutate(MODULE_ISSUES(moduleId as string));

          mutate(PROJECT_ISSUES_LIST(workspaceSlug as string, projectId as string));
        })
        .catch((error) => {
          console.log(error);
        });
    },
    [workspaceSlug, projectId, cycleId, moduleId, issue]
  );

  const getStyle = (
    style: DraggingStyle | NotDraggingStyle | undefined,
    snapshot: DraggableStateSnapshot
  ) => {
    if (orderBy === "sort_order") return style;
    if (!snapshot.isDragging) return {};
    if (!snapshot.isDropAnimating) {
      return style;
    }

    return {
      ...style,
      transitionDuration: `0.001s`,
    };
  };

  const handleCopyText = () => {
    const originURL =
      typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
    copyTextToClipboard(
      `${originURL}/${workspaceSlug}/projects/${projectId}/issues/${issue.id}`
    ).then(() => {
      setToastAlert({
        type: "success",
        title: "Link Copied!",
        message: "Issue link copied to clipboard.",
      });
    });
  };

  useEffect(() => {
    if (snapshot.isDragging) handleTrashBox(snapshot.isDragging);
  }, [snapshot, handleTrashBox]);

  const isNotAllowed = userAuth.isGuest || userAuth.isViewer;

  return (
    <>
      <ContextMenu
        position={contextMenuPosition}
        title="Quick actions"
        isOpen={contextMenu}
        setIsOpen={setContextMenu}
      >
        <ContextMenu.Item Icon={PencilIcon} onClick={editIssue}>
          Edit issue
        </ContextMenu.Item>
        <ContextMenu.Item Icon={ClipboardDocumentCheckIcon} onClick={makeIssueCopy}>
          Make a copy...
        </ContextMenu.Item>
        <ContextMenu.Item Icon={TrashIcon} onClick={() => handleDeleteIssue(issue)}>
          Delete issue
        </ContextMenu.Item>
        <ContextMenu.Item Icon={LinkIcon} onClick={handleCopyText}>
          Copy issue link
        </ContextMenu.Item>
      </ContextMenu>
      <div
        className={`mb-3 rounded bg-white shadow ${
          snapshot.isDragging ? "border-2 border-theme shadow-lg" : ""
        }`}
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        style={getStyle(provided.draggableProps.style, snapshot)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu(true);
          setContextMenuPosition({ x: e.pageX, y: e.pageY });
        }}
      >
        <div className="group/card relative select-none p-4">
          {!isNotAllowed && (
            <div className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover/card:opacity-100">
              {type && !isNotAllowed && (
                <CustomMenu width="auto" ellipsis>
                  <CustomMenu.MenuItem onClick={editIssue}>Edit issue</CustomMenu.MenuItem>
                  {type !== "issue" && removeIssue && (
                    <CustomMenu.MenuItem onClick={removeIssue}>
                      <>Remove from {type}</>
                    </CustomMenu.MenuItem>
                  )}
                  <CustomMenu.MenuItem onClick={() => handleDeleteIssue(issue)}>
                    Delete issue
                  </CustomMenu.MenuItem>
                  <CustomMenu.MenuItem onClick={handleCopyText}>
                    Copy issue link
                  </CustomMenu.MenuItem>
                </CustomMenu>
              )}
            </div>
          )}
          <Link href={`/${workspaceSlug}/projects/${issue.project}/issues/${issue.id}`}>
            <a>
              {properties.key && (
                <div className="mb-2.5 text-xs font-medium text-gray-700">
                  {issue.project_detail.identifier}-{issue.sequence_id}
                </div>
              )}
              <h5
                className="break-all text-sm group-hover:text-theme"
                style={{ lineClamp: 3, WebkitLineClamp: 3 }}
              >
                {truncateText(issue.name, 100)}
              </h5>
            </a>
          </Link>
          <div className="relative mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            {properties.priority && (
              <ViewPrioritySelect
                issue={issue}
                partialUpdateIssue={partialUpdateIssue}
                isNotAllowed={isNotAllowed}
                selfPositioned
              />
            )}
            {properties.state && (
              <ViewStateSelect
                issue={issue}
                partialUpdateIssue={partialUpdateIssue}
                isNotAllowed={isNotAllowed}
                selfPositioned
              />
            )}
            {properties.due_date && (
              <ViewDueDateSelect
                issue={issue}
                partialUpdateIssue={partialUpdateIssue}
                isNotAllowed={isNotAllowed}
              />
            )}
            {properties.sub_issue_count && (
              <div className="flex flex-shrink-0 items-center gap-1 rounded-md border px-3 py-1.5 text-xs shadow-sm">
                {issue.sub_issues_count} {issue.sub_issues_count === 1 ? "sub-issue" : "sub-issues"}
              </div>
            )}
            {properties.labels && issue.label_details.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {issue.label_details.map((label) => (
                  <span
                    key={label.id}
                    className="group flex items-center gap-1 rounded-2xl border px-2 py-0.5 text-xs"
                  >
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{
                        backgroundColor: label?.color && label.color !== "" ? label.color : "#000",
                      }}
                    />
                    {label.name}
                  </span>
                ))}
              </div>
            )}
            {properties.assignee && (
              <ViewAssigneeSelect
                issue={issue}
                partialUpdateIssue={partialUpdateIssue}
                isNotAllowed={isNotAllowed}
                tooltipPosition="left"
                selfPositioned
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};