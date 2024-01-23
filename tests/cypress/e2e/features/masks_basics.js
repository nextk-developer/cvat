// Copyright (C) 2022-2024 CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

/// <reference types="cypress" />

context('Manipulations with masks', { scrollBehavior: false }, () => {
    const taskName = 'Basic actions with masks';
    const serverFiles = ['images/image_1.jpg', 'images/image_2.jpg', 'images/image_3.jpg'];

    const drawingActions = [{
        method: 'brush',
        coordinates: [[300, 300], [700, 300], [700, 700], [300, 700]],
    }, {
        method: 'polygon-plus',
        coordinates: [[450, 210], [650, 400], [450, 600], [260, 400]],
    }, {
        method: 'brush-size',
        value: 150,
    }, {
        method: 'eraser',
        coordinates: [[500, 500]],
    }, {
        method: 'brush-size',
        value: 10,
    }, {
        method: 'polygon-minus',
        coordinates: [[450, 400], [600, 400], [450, 550], [310, 400]],
    }];

    const editingActions = [{
        method: 'polygon-minus',
        coordinates: [[50, 400], [800, 400], [800, 800], [50, 800]],
    }];

    let taskID = null;
    let jobID = null;

    before(() => {
        cy.visit('auth/login');
        cy.login();
        cy.headlessCreateTask({
            labels: [{ name: 'mask label', attributes: [], type: 'any' }],
            name: taskName,
            project_id: null,
            source_storage: { location: 'local' },
            target_storage: { location: 'local' },
        }, {
            server_files: serverFiles,
            image_quality: 70,
            use_zip_chunks: true,
            use_cache: true,
            sorting_method: 'lexicographical',
        }).then((response) => {
            taskID = response.taskID;
            [jobID] = response.jobIDs;
        }).then(() => {
            cy.visit(`/tasks/${taskID}/jobs/${jobID}`);
            cy.get('.cvat-canvas-container').should('exist').and('be.visible');
        });
    });

    after(() => {
        cy.logout();
        cy.getAuthKey().then((response) => {
            const authKey = response.body.key;
            cy.request({
                method: 'DELETE',
                url: `/api/tasks/${taskID}`,
                headers: {
                    Authorization: `Token ${authKey}`,
                },
            });
        });
    });

    describe('Basic masks actions', () => {
        beforeEach(() => {
            cy.removeAnnotations();
            cy.goCheckFrameNumber(0);
        });

        after(() => {
            cy.removeAnnotations();
        });

        it('Drawing a couple of masks. Save job, reopen job, masks must exist', () => {
            cy.startMaskDrawing();
            cy.drawMask(drawingActions);
            cy.get('.cvat-brush-tools-finish').click();
            cy.get('.cvat-brush-tools-continue').click();
            cy.get('.cvat-brush-tools-toolbox').should('exist').and('be.visible');
            cy.get('#cvat_canvas_shape_1').should('exist').and('be.visible');

            // it is expected, that after clicking "continue", brush tools are still opened
            cy.drawMask(drawingActions);
            cy.finishMaskDrawing();
            cy.get('.cvat-brush-tools-toolbox').should('not.be.visible');

            cy.saveJob();
            cy.reload();

            for (const id of [1, 2]) {
                cy.get(`#cvat_canvas_shape_${id}`).should('exist').and('be.visible');
            }
            cy.removeAnnotations();
        });

        it('Propagate mask to another frame', () => {
            cy.startMaskDrawing();
            cy.drawMask(drawingActions);
            cy.finishMaskDrawing();

            cy.get('#cvat-objects-sidebar-state-item-1').find('[aria-label="more"]').trigger('mouseover');
            cy.get('.cvat-object-item-menu').within(() => {
                cy.contains('button', 'Propagate').click();
            });
            cy.get('.cvat-propagate-confirm-up-to-input').find('input')
                .should('have.attr', 'value', serverFiles.length - 1);
            cy.contains('button', 'Yes').click();
            for (let i = 1; i < serverFiles.length; i++) {
                cy.goCheckFrameNumber(i);
                cy.get('.cvat_canvas_shape').should('exist').and('be.visible');
            }
        });

        it('Copy mask to another frame', () => {
            cy.startMaskDrawing();
            cy.drawMask(drawingActions);
            cy.finishMaskDrawing();

            cy.get('#cvat-objects-sidebar-state-item-1').within(() => {
                cy.get('[aria-label="more"]').trigger('mouseover');
            });
            cy.get('.cvat-object-item-menu').last().should('be.visible').contains('button', 'Make a copy').click();
            cy.goCheckFrameNumber(serverFiles.length - 1);
            cy.get('.cvat-canvas-container').click();
            cy.get('#cvat_canvas_shape_2').should('exist').and('be.visible');
        });

        it('Check hidden mask still invisible after changing frame/opacity', () => {
            cy.startMaskDrawing();
            cy.drawMask(drawingActions);
            cy.finishMaskDrawing();

            cy.get('#cvat-objects-sidebar-state-item-1').within(() => {
                cy.get('.cvat-object-item-button-hidden')
                    .should('exist').and('be.visible').click();
                cy.get('.cvat-object-item-button-hidden')
                    .should('have.class', 'cvat-object-item-button-hidden-enabled');
            });

            cy.goCheckFrameNumber(serverFiles.length - 1);
            cy.goCheckFrameNumber(0);

            cy.get('.cvat-appearance-opacity-slider').click('right');
            cy.get('.cvat-appearance-opacity-slider').click('center');
            cy.get('#cvat_canvas_shape_1')
                .should('exist').and('have.class', 'cvat_canvas_hidden').and('not.be.visible');
        });

        it('Editing a drawn mask', () => {
            cy.startMaskDrawing();
            cy.drawMask(drawingActions);
            cy.finishMaskDrawing();

            cy.get('#cvat-objects-sidebar-state-item-1').within(() => {
                cy.get('[aria-label="more"]').trigger('mouseover');
            });
            cy.get('.cvat-object-item-menu').last().should('be.visible').contains('button', 'Edit').click();
            cy.drawMask(editingActions);
            cy.finishMaskDrawing();
        });
    });

    describe('Empty masks actions', () => {
        beforeEach(() => {
            cy.removeAnnotations();
        });

        after(() => {
            cy.removeAnnotations();
        });

        function checkEraseTools(baseTool = '.cvat-brush-tools-brush', disabled = true) {
            cy.get(baseTool).should('have.class', 'cvat-brush-tools-active-tool');

            const condition = disabled ? 'be.disabled' : 'not.be.disabled';
            cy.get('.cvat-brush-tools-eraser').should(condition);
            cy.get('.cvat-brush-tools-polygon-minus').should(condition);
        }

        it(
            'Drawing a mask, fully erase it. Erase tools are blocked with empty mask. Empty shape is not created.',
            () => {
                const erasedMask = [{
                    method: 'brush',
                    coordinates: [[450, 250], [600, 400], [450, 550], [300, 400]],
                }, {
                    method: 'polygon-minus',
                    coordinates: [[100, 100], [700, 100], [700, 700], [100, 700]],
                }];

                cy.startMaskDrawing();
                cy.drawMask(erasedMask);

                cy.get('.cvat-brush-tools-brush').click();
                checkEraseTools();

                cy.finishMaskDrawing();
                cy.get('#cvat_canvas_shape_1').should('not.exist');
            });

        it('Drawing a mask, finish with erasing tool. On new mask drawing tool is reset', () => {
            const masks = [
                [
                    {
                        method: 'brush',
                        coordinates: [[450, 250], [600, 400], [450, 550], [300, 400]],
                    }, {
                        method: 'polygon-minus',
                        coordinates: [[100, 100], [400, 100], [400, 400], [100, 400]],
                    },
                ],
                [
                    {
                        method: 'brush',
                        coordinates: [[550, 350], [700, 500], [550, 650], [400, 500]],
                    }, {
                        method: 'eraser',
                        coordinates: [[550, 350]],
                    },
                ],
            ];
            for (const [index, mask] of masks.entries()) {
                cy.startMaskDrawing();
                cy.drawMask(mask);
                cy.finishMaskDrawing();

                cy.get(`#cvat_canvas_shape_${index + 1}`).should('exist').and('be.visible');

                cy.startMaskDrawing();
                checkEraseTools();
                cy.finishMaskDrawing();
            }
        });

        it('Empty masks are deleted using remove underlying pixels feature', () => {
            const masks = [
                [
                    {
                        method: 'brush',
                        coordinates: [[150, 150], [170, 170]],
                    },
                ],
                [
                    {
                        method: 'brush',
                        coordinates: [[250, 250], [270, 270]],
                    },
                ],
                [
                    {
                        method: 'brush',
                        coordinates: [[350, 350], [370, 370]],
                    },
                ],
                [

                    {
                        method: 'polygon-plus',
                        coordinates: [[100, 100], [400, 100], [400, 400], [100, 400]],
                    },
                ],
            ];

            cy.startMaskDrawing();
            cy.get('.cvat-brush-tools-underlying-pixels').click();
            cy.get('.cvat-brush-tools-underlying-pixels').should('have.class', 'cvat-brush-tools-active-tool');
            cy.finishMaskDrawing();

            for (const [index, mask] of masks.entries()) {
                cy.startMaskDrawing();
                cy.drawMask(mask);
                cy.finishMaskDrawing();

                cy.get(`#cvat_canvas_shape_${index + 1}`).should('exist').and('be.visible');
            }

            cy.contains('Some objects were deleted').should('exist').and('be.visible');
            for (const id of [1, 4]) {
                cy.get(`#cvat_canvas_shape_${id}`).should('exist').and('be.visible');
            }
        });
    });
});
